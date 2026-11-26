"""請求追蹤：每個請求一個 request id，方便把前端看到的錯誤對到後端日誌。

- 前端可以帶 `X-Request-Id`（1–64 個英數與 `-_`）；沒有帶或格式不符時由後端產生
- 回應一律帶 `X-Request-Id` 標頭（錯誤 JSON 維持 {code, message}，不加欄位，避免破壞前端與測試的契約）
- 每個請求結束時記錄一行：`rid=… GET /api/me 200 12ms`；未處理的例外附上完整 traceback，
  並回 500 JSON `{code: INTERNAL_ERROR, message: …（錯誤代碼 rid）}`，使用者回報錯誤代碼就能找到那次請求
- 在日誌中搜尋 request id，就能找到同一個請求的所有紀錄
"""

import json
import logging
import re
import time
import uuid
from contextvars import ContextVar

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

log = logging.getLogger("app.request")

HEADER = "x-request-id"
_VALID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def configure_logging() -> None:
    """讓 `app.*` 的日誌（請求日誌、project fallback 警告等）顯示出來。

    uvicorn 只設定自己的 logger，應用程式的 INFO 日誌預設不會輸出。重複呼叫（例如 --reload）不會加重複的 handler
    """
    logger = logging.getLogger("app")
    logger.setLevel(logging.INFO)
    if not any(getattr(h, "_taskline", False) for h in logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s %(message)s", "%H:%M:%S"))
        handler._taskline = True  # type: ignore[attr-defined]
        logger.addHandler(handler)


def current_request_id() -> str | None:
    """目前請求的 request id；不在請求中（腳本、測試）時為 None"""
    return _request_id.get()


class RequestIdMiddleware:
    """純 ASGI middleware：設定 request id、加回應標頭、記錄請求結果。

    要放在 CORSMiddleware 裡面（CORS 在最外層）：未處理的例外由這裡送出 500 JSON，
    如果在 CORS 外面，這個回應沒有 CORS 標頭，瀏覽器會擋掉，前端讀不到錯誤代碼與 X-Request-Id
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = next((v.decode("latin-1") for k, v in scope["headers"] if k == HEADER.encode()), "")
        rid = incoming if _VALID.match(incoming) else uuid.uuid4().hex[:12]
        token = _request_id.set(rid)
        status = 500
        started = False
        t0 = time.perf_counter()

        async def send_with_id(message: Message) -> None:
            nonlocal status, started
            if message["type"] == "http.response.start":
                started = True
                status = message["status"]
                MutableHeaders(scope=message)[HEADER] = rid
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            log.exception("rid=%s %s %s 未處理的例外", rid, scope["method"], scope["path"])
            if started:
                raise
            # 回應還沒開始：回 JSON（與一般錯誤相同的 {code, message}），訊息附上 request id 方便回報
            body = json.dumps(
                {"code": "INTERNAL_ERROR", "message": f"伺服器發生錯誤，請稍後再試（錯誤代碼 {rid}）"},
                ensure_ascii=False,
            ).encode()
            await send_with_id(
                {
                    "type": "http.response.start",
                    "status": 500,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
                }
            )
            await send({"type": "http.response.body", "body": body})
        finally:
            ms = round((time.perf_counter() - t0) * 1000)
            # health 與預檢請求很頻繁，只在出錯時記錄
            quiet = scope["method"] == "OPTIONS" or scope["path"].endswith("/health")
            if status >= 400 or not quiet:
                log.log(
                    logging.WARNING if status >= 500 else logging.INFO,
                    "rid=%s %s %s %s %sms",
                    rid,
                    scope["method"],
                    scope["path"],
                    status,
                    ms,
                )
            _request_id.reset(token)
