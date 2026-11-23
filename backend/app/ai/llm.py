"""LLM 封裝層：所有 AI 功能都透過 `LlmClient` 呼叫模型，不直接依賴 OpenAI SDK。

- 正式環境：`OpenAILlm`（structured output，回傳已驗證的 pydantic 物件）
- 測試：用 FastAPI 的 dependency_overrides 換成假的 LlmClient，不需要 API 金鑰
"""

import logging
import time
from functools import lru_cache
from typing import Annotated, Any, Protocol, TypeVar

import openai
from fastapi import Depends
from pydantic import BaseModel

from app.ai import audit
from app.core.config import get_settings
from app.core.errors import ApiError

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LlmClient(Protocol):
    def generate_json(self, *, system: str, user: str, schema: type[T]) -> T:
        """依 schema 產生結構化輸出"""
        ...

    def generate_text(self, *, system: str, user: str) -> str:
        """產生純文字回覆"""
        ...


class OpenAILlm:
    def __init__(
        self,
        client: openai.OpenAI,
        model: str,
        *,
        temperature: float | None = None,
        text_temperature: float | None = None,
    ) -> None:
        self._client = client
        self._model = model
        # [v0.2 修改] 修改前沒有設定 temperature，使用 API 預設值 1，同樣的輸入每次結果差異較大
        self._temperature = temperature
        self._text_temperature = text_temperature

    @staticmethod
    def _sampling(temperature: float | None) -> dict[str, float]:
        """temperature 為 None 時不傳，讓不支援此參數的模型也能使用"""
        return {} if temperature is None else {"temperature": temperature}

    def generate_json(self, *, system: str, user: str, schema: type[T]) -> T:
        params = self._sampling(self._temperature)  # [v0.2 修改]
        t0 = time.perf_counter()
        try:
            res = self._client.chat.completions.parse(
                model=self._model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format=schema,
                **params,
            )
        except openai.OpenAIError as exc:
            self._audit("json", system, user, schema.__name__, params, t0, error=f"{type(exc).__name__}: {exc}")
            raise _to_api_error(exc) from exc
        message = res.choices[0].message
        self._audit(
            "json", system, user, schema.__name__, params, t0, res=res, output=getattr(message, "content", None)
        )
        if message.refusal:
            raise ApiError("AI 無法處理這份內容，請調整後再試", status=422, code="AI_REFUSED")
        if message.parsed is None:
            raise ApiError("AI 回傳的格式不正確，請重試", status=502, code="AI_BAD_OUTPUT")
        self._log_usage(res)
        return message.parsed

    def generate_text(self, *, system: str, user: str) -> str:
        params = self._sampling(self._text_temperature)  # [v0.2 修改]
        t0 = time.perf_counter()
        try:
            res = self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                **params,
            )
        except openai.OpenAIError as exc:
            self._audit("text", system, user, None, params, t0, error=f"{type(exc).__name__}: {exc}")
            raise _to_api_error(exc) from exc
        self._audit(
            "text", system, user, None, params, t0, res=res, output=getattr(res.choices[0].message, "content", None)
        )
        self._log_usage(res)
        return res.choices[0].message.content or ""

    def _audit(
        self,
        kind: str,
        system: str,
        user: str,
        schema_name: str | None,
        params: dict[str, float],
        t0: float,
        *,
        res: Any = None,
        output: str | None = None,
        error: str | None = None,
    ) -> None:
        """寫入稽核紀錄（app/ai/audit.py）：提示詞、模型、token、模型原始回傳、耗時、錯誤"""
        usage = getattr(res, "usage", None)
        choice = res.choices[0] if res is not None else None
        audit.llm_call(
            kind=kind,
            schema=schema_name,
            model=getattr(res, "model", None) or self._model,
            temperature=params.get("temperature"),
            system_prompt=system,
            user_message=user,
            prompt_tokens=getattr(usage, "prompt_tokens", None),
            completion_tokens=getattr(usage, "completion_tokens", None),
            total_tokens=getattr(usage, "total_tokens", None),
            finish_reason=getattr(choice, "finish_reason", None),
            raw_output=output,
            refusal=getattr(getattr(choice, "message", None), "refusal", None),
            duration_ms=round((time.perf_counter() - t0) * 1000),
            error=error,
        )

    def _log_usage(self, res: object) -> None:
        usage = getattr(res, "usage", None)
        if usage:
            log.info("llm usage model=%s in=%s out=%s", self._model, usage.prompt_tokens, usage.completion_tokens)


def _to_api_error(exc: openai.OpenAIError) -> ApiError:
    log.warning("OpenAI 呼叫失敗：%s", exc)
    if isinstance(exc, openai.RateLimitError):
        return ApiError("AI 服務目前較忙碌，請稍後再試", status=429, code="AI_RATE_LIMITED")
    if isinstance(exc, openai.APITimeoutError):
        return ApiError("AI 服務回應逾時，請重試", status=504, code="AI_TIMEOUT")
    return ApiError("AI 服務暫時無法使用", status=502, code="AI_UNAVAILABLE")


@lru_cache
def get_llm() -> LlmClient:
    settings = get_settings()
    if not settings.openai_api_key:
        raise ApiError("尚未設定 OPENAI_API_KEY", status=503, code="AI_NOT_CONFIGURED")
    client = openai.OpenAI(api_key=settings.openai_api_key, timeout=settings.openai_timeout_seconds, max_retries=2)
    return OpenAILlm(
        client,
        settings.openai_model,
        temperature=settings.openai_temperature,  # [v0.2 修改]
        text_temperature=settings.openai_text_temperature,
    )


Llm = Annotated[LlmClient, Depends(get_llm)]
