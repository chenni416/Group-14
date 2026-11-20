"""LLM 封裝層：所有 AI 功能都透過 `LlmClient` 呼叫模型，不直接依賴 OpenAI SDK。

- 正式環境：`OpenAILlm`（structured output，回傳已驗證的 pydantic 物件）
- 測試：用 FastAPI 的 dependency_overrides 換成假的 LlmClient，不需要 API 金鑰
"""

import logging
from functools import lru_cache
from typing import Annotated, Protocol, TypeVar

import openai
from fastapi import Depends
from pydantic import BaseModel

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
    def __init__(self, client: openai.OpenAI, model: str) -> None:
        self._client = client
        self._model = model

    def generate_json(self, *, system: str, user: str, schema: type[T]) -> T:
        try:
            res = self._client.chat.completions.parse(
                model=self._model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format=schema,
            )
        except openai.OpenAIError as exc:
            raise _to_api_error(exc) from exc
        message = res.choices[0].message
        if message.refusal:
            raise ApiError("AI 無法處理這份內容，請調整後再試", status=422, code="AI_REFUSED")
        if message.parsed is None:
            raise ApiError("AI 回傳的格式不正確，請重試", status=502, code="AI_BAD_OUTPUT")
        self._log_usage(res)
        return message.parsed

    def generate_text(self, *, system: str, user: str) -> str:
        try:
            res = self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            )
        except openai.OpenAIError as exc:
            raise _to_api_error(exc) from exc
        self._log_usage(res)
        return res.choices[0].message.content or ""

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
    return OpenAILlm(client, settings.openai_model)


Llm = Annotated[LlmClient, Depends(get_llm)]
