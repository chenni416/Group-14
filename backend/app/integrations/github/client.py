"""GitHub API 呼叫。

認證方式：
- App JWT：用 private key 簽發，代表 GitHub App 本身（查詢安裝資訊、換 installation token）
- installation token：代表某個安裝，讀取被授權的 repo；一小時過期，這裡快取並在過期前重新換發
- 使用者 token：安裝時一併取得的使用者授權，只用來確認「這個安裝是登入者可以存取的」
"""

import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx
import jwt

from app.core.config import get_settings
from app.core.errors import ApiError

API = "https://api.github.com"
OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
TIMEOUT = 10
HEADERS = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}


@dataclass(frozen=True)
class Repository:
    id: int
    full_name: str
    html_url: str
    default_branch: str
    private: bool


@dataclass(frozen=True)
class Installation:
    id: int
    account_id: int
    account_login: str
    account_type: str
    account_avatar_url: str | None
    repository_selection: str


def _not_configured(field: str) -> ApiError:
    return ApiError(f"後端尚未設定 GitHub App（{field}）", status=503, code="GITHUB_NOT_CONFIGURED")


def _unavailable() -> ApiError:
    return ApiError("暫時無法連線到 GitHub，請稍後再試", status=502, code="GITHUB_UNAVAILABLE")


def install_url(state: str) -> str:
    slug = get_settings().github_app_slug
    if not slug:
        raise _not_configured("GITHUB_APP_SLUG")
    return f"https://github.com/apps/{slug}/installations/new?state={state}"


@lru_cache
def _private_key(path: str) -> str:
    try:
        return Path(path).expanduser().read_text()
    except OSError as exc:
        raise _not_configured("GITHUB_PRIVATE_KEY_PATH 讀不到檔案") from exc


def app_jwt() -> str:
    settings = get_settings()
    if not settings.github_app_id:
        raise _not_configured("GITHUB_APP_ID")
    if not settings.github_private_key_path:
        raise _not_configured("GITHUB_PRIVATE_KEY_PATH")
    now = int(time.time())
    # iat 往前 60 秒，避免伺服器時間誤差；GitHub 規定最長 10 分鐘
    claims = {"iat": now - 60, "exp": now + 9 * 60, "iss": settings.github_app_id}
    return jwt.encode(claims, _private_key(settings.github_private_key_path), algorithm="RS256")


def _request(method: str, url: str, *, token: str, **kwargs: Any) -> httpx.Response:
    try:
        res = httpx.request(
            method, url, headers={**HEADERS, "Authorization": f"Bearer {token}"}, timeout=TIMEOUT, **kwargs
        )
    except httpx.HTTPError as exc:
        raise _unavailable() from exc
    if res.status_code >= 500:
        raise _unavailable()
    return res


# installation id → (token, 過期時間)
_token_cache: dict[int, tuple[str, float]] = {}


def installation_token(installation_id: int) -> str:
    cached = _token_cache.get(installation_id)
    if cached and cached[1] - time.time() > 5 * 60:
        return cached[0]
    res = _request("POST", f"{API}/app/installations/{installation_id}/access_tokens", token=app_jwt())
    if res.status_code == 404:
        raise ApiError("找不到這個 GitHub App 安裝，可能已被移除", status=404, code="INSTALLATION_NOT_FOUND")
    if res.status_code != 201:
        raise _unavailable()
    token = res.json()["token"]
    # GitHub 的 token 一小時過期；以一小時計算即可，到期前 5 分鐘重新換發
    _token_cache[installation_id] = (token, time.time() + 3600)
    return token


def get_installation(installation_id: int) -> Installation:
    res = _request("GET", f"{API}/app/installations/{installation_id}", token=app_jwt())
    if res.status_code == 404:
        raise ApiError("找不到這個 GitHub App 安裝，可能已被移除", status=404, code="INSTALLATION_NOT_FOUND")
    if res.status_code != 200:
        raise _unavailable()
    data = res.json()
    account = data.get("account") or {}
    return Installation(
        id=data["id"],
        account_id=account.get("id", 0),
        account_login=account.get("login", ""),
        account_type="Organization" if account.get("type") == "Organization" else "User",
        account_avatar_url=account.get("avatar_url"),
        repository_selection=data.get("repository_selection", "selected"),
    )


def list_installation_repositories(installation_id: int) -> list[Repository]:
    token = installation_token(installation_id)
    repos: list[Repository] = []
    page = 1
    while True:
        res = _request("GET", f"{API}/installation/repositories", token=token, params={"per_page": 100, "page": page})
        if res.status_code != 200:
            raise _unavailable()
        items = res.json().get("repositories", [])
        repos += [
            Repository(
                id=r["id"],
                full_name=r["full_name"],
                html_url=r["html_url"],
                default_branch=r.get("default_branch") or "main",
                private=bool(r.get("private")),
            )
            for r in items
        ]
        if len(items) < 100:
            return repos
        page += 1


def exchange_user_code(code: str) -> str:
    """把安裝時取得的使用者授權碼換成使用者 token"""
    settings = get_settings()
    if not settings.github_client_id or not settings.github_client_secret:
        raise _not_configured("GITHUB_CLIENT_ID／GITHUB_CLIENT_SECRET")
    try:
        res = httpx.post(
            OAUTH_TOKEN_URL,
            data={"client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": code},
            headers={"Accept": "application/json"},
            timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise _unavailable() from exc
    token = res.json().get("access_token") if res.status_code == 200 else None
    if not token:
        raise ApiError("GitHub 授權已失效，請重新連結", status=400, code="GITHUB_AUTH_FAILED")
    return token


def user_installation_ids(user_token: str) -> set[int]:
    """登入者可以存取的 GitHub App 安裝"""
    ids: set[int] = set()
    page = 1
    while True:
        res = _request("GET", f"{API}/user/installations", token=user_token, params={"per_page": 100, "page": page})
        if res.status_code != 200:
            raise ApiError("GitHub 授權已失效，請重新連結", status=400, code="GITHUB_AUTH_FAILED")
        items = res.json().get("installations", [])
        ids |= {i["id"] for i in items}
        if len(items) < 100:
            return ids
        page += 1
