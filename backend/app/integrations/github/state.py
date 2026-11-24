"""GitHub App 安裝流程的 state 參數。

產生安裝網址時把「哪個專案、哪位成員、何時過期」簽章後放進 state，GitHub 安裝完成後原樣帶回。
回呼時驗證簽章與期限，確保這次安裝是由同一位 Leader 為同一個專案發起，不能偽造或拿去綁別的專案。
"""

import base64
import hashlib
import hmac
import json
import time
import uuid

from app.core.config import get_settings
from app.core.errors import ApiError

STATE_TTL_SECONDS = 30 * 60


def _key() -> bytes:
    secret = get_settings().github_client_secret
    if not secret:
        raise ApiError("後端尚未設定 GitHub App（GITHUB_CLIENT_SECRET）", status=503, code="GITHUB_NOT_CONFIGURED")
    return hashlib.sha256(b"taskline-github-state:" + secret.encode()).digest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_state(project_id: uuid.UUID, member_id: uuid.UUID, *, now: float | None = None) -> str:
    payload = {"p": str(project_id), "m": str(member_id), "e": int((now or time.time()) + STATE_TTL_SECONDS)}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_key(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verify_state(state: str, *, now: float | None = None) -> tuple[uuid.UUID, uuid.UUID]:
    """回傳 (專案 id, 成員 id)；簽章不符、格式錯誤或過期時回傳 400"""
    invalid = ApiError("連結 GitHub 的流程已失效，請重新開始", status=400, code="INVALID_STATE")
    try:
        body, sig = state.split(".", 1)
        expected = _b64(hmac.new(_key(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise invalid
        payload = json.loads(_unb64(body))
        if int(payload["e"]) < (now or time.time()):
            raise invalid
        return uuid.UUID(payload["p"]), uuid.UUID(payload["m"])
    except ApiError:
        raise
    except (ValueError, KeyError, TypeError) as exc:
        raise invalid from exc
