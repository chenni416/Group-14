"""AI 呼叫稽核紀錄：每個有呼叫 OpenAI 的 API 請求，寫成一筆完整紀錄（JSON Lines）。

一筆紀錄包含：
- request：前端送來的請求（路徑、身分、內容）
- llm_calls：每一次呼叫模型的提示詞（system / user）、模型、temperature、token 用量、模型原始回傳、耗時、錯誤
- adjustments：程式對模型輸出做的捨棄與修正（例如丟掉編造的行號、移除循環相依、驗算 capacity）
- response：API 回給前端的狀態碼與內容（網頁收到的就是這份）

紀錄檔位置由 `AI_LOG_PATH` 決定（預設 backend/logs/ai-calls.jsonl，留空表示不記錄）。
開發環境可以用 `GET /api/dev/ai-logs` 查看最近的紀錄。

實作方式：middleware 在每個請求開始時建立一個 Record 放進 ContextVar，
`OpenAILlm` 與各服務在處理過程中呼叫 `llm_call()`、`note()` 加進去，請求結束時由 middleware 寫檔。
沒有呼叫模型的請求不會寫入。
"""

import json
import logging
import threading
import time
import uuid
from collections import deque
from contextvars import ContextVar, Token
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.config import get_settings

log = logging.getLogger(__name__)

MAX_BODY_BYTES = 200_000
"""請求與回應內容各自最多記錄的位元組數，超過會截斷"""

_write_lock = threading.Lock()


@dataclass
class Record:
    request: dict[str, Any]
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat(timespec="milliseconds"))
    t0: float = field(default_factory=time.perf_counter)
    llm_calls: list[dict[str, Any]] = field(default_factory=list)
    adjustments: list[dict[str, Any]] = field(default_factory=list)


_current: ContextVar[Record | None] = ContextVar("ai_audit_record", default=None)


def llm_call(**fields: Any) -> None:
    """記錄一次模型呼叫；不在請求中（例如評測腳本）時什麼都不做"""
    record = _current.get()
    if record is not None:
        record.llm_calls.append({"seq": len(record.llm_calls) + 1, **fields})


def note(kind: str, detail: str, **data: Any) -> None:
    """記錄程式對模型輸出做的捨棄或修正。`after_call` 是它處理的是第幾次模型呼叫的輸出"""
    record = _current.get()
    if record is not None:
        record.adjustments.append({"after_call": len(record.llm_calls), "kind": kind, "detail": detail, **data})


def _log_path() -> Path | None:
    raw = get_settings().ai_log_path.strip()
    return Path(raw) if raw else None


def _parse_body(raw: bytes) -> Any:
    if not raw:
        return None
    truncated = len(raw) > MAX_BODY_BYTES
    raw = raw[:MAX_BODY_BYTES]
    try:
        return json.loads(raw)
    except ValueError:
        text = raw.decode("utf-8", errors="replace")
        return text + ("…（已截斷）" if truncated else "")


def write(record: Record, *, status: int, response: bytes, error: str | None = None) -> None:
    path = _log_path()
    if path is None or not record.llm_calls:
        return
    usage = [c for c in record.llm_calls if c.get("total_tokens") is not None]
    entry = {
        "id": record.id,
        "started_at": record.started_at,
        "duration_ms": round((time.perf_counter() - record.t0) * 1000),
        "request": record.request,
        "llm_calls": record.llm_calls,
        "totals": {
            "calls": len(record.llm_calls),
            "prompt_tokens": sum(c.get("prompt_tokens") or 0 for c in usage),
            "completion_tokens": sum(c.get("completion_tokens") or 0 for c in usage),
            "total_tokens": sum(c.get("total_tokens") or 0 for c in usage),
        },
        "adjustments": record.adjustments,
        "response": {"status": status, "body": _parse_body(response), **({"error": error} if error else {})},
    }
    try:
        with _write_lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")
    except OSError as exc:  # 記錄失敗不能影響 API 本身
        log.warning("AI 稽核紀錄寫入失敗：%s", exc)


def read_recent(limit: int = 20) -> list[dict[str, Any]]:
    """最近的紀錄，新的在前面"""
    path = _log_path()
    if path is None or not path.exists():
        return []
    with path.open(encoding="utf-8") as f:
        lines = deque(f, maxlen=max(limit, 1))
    out: list[dict[str, Any]] = []
    for line in reversed(lines):
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


class AuditMiddleware:
    """為每個請求建立 Record，結束時（有呼叫過模型才）寫入。純 ASGI，才能取得請求與回應的原始內容"""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] == "OPTIONS" or _log_path() is None:
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        member = headers.get("x-demo-user") or ("（已登入 token）" if "authorization" in headers else "（未登入）")
        request_body = bytearray()
        response_body = bytearray()
        status = 500

        async def recv() -> Message:
            message = await receive()
            if message["type"] == "http.request" and len(request_body) < MAX_BODY_BYTES:
                request_body.extend(message.get("body", b""))
            return message

        async def send_wrapper(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
            elif message["type"] == "http.response.body" and len(response_body) < MAX_BODY_BYTES:
                response_body.extend(message.get("body", b""))
            await send(message)

        record = Record(request={"method": scope["method"], "path": scope["path"], "member": member})
        token: Token = _current.set(record)
        error: str | None = None
        try:
            await self.app(scope, recv, send_wrapper)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            raise
        finally:
            _current.reset(token)
            query = scope.get("query_string", b"").decode()
            if query:
                record.request["query"] = query
            record.request["body"] = _parse_body(bytes(request_body))
            write(record, status=status, response=bytes(response_body), error=error)
