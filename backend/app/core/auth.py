"""登入驗證與權限。

前端以 Supabase Auth（GitHub 登入）取得 access token，放在 `Authorization` header；
後端負責驗證 token，並在開發環境保留以 `X-Demo-User` 指定測試成員的入口。
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.errors import ApiError
from app.repo import Store
from app.schemas.member import Member

AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True)
class AuthUser:
    """從 Supabase token 取得的登入身分（GitHub 帳號資料）"""

    id: str
    email: str
    github_login: str | None
    name: str
    avatar_url: str | None


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)


def _issuer() -> str:
    return f"{get_settings().supabase_url.rstrip('/')}/auth/v1"


def _signing_key(token: str) -> tuple[Any, list[str]]:
    settings = get_settings()
    try:
        alg = jwt.get_unverified_header(token).get("alg")
    except jwt.InvalidTokenError as exc:
        raise ApiError("登入資訊無效，請重新登入", status=401, code="INVALID_TOKEN") from exc

    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise ApiError("登入資訊無效，請重新登入", status=401, code="INVALID_TOKEN")
        return settings.supabase_jwt_secret, ["HS256"]

    if not settings.supabase_url:
        raise ApiError("後端尚未設定 SUPABASE_URL", status=500, code="AUTH_NOT_CONFIGURED")
    try:
        key = _jwks_client(f"{_issuer()}/.well-known/jwks.json").get_signing_key_from_jwt(token).key
    except jwt.PyJWKClientConnectionError as exc:
        raise ApiError("暫時無法驗證登入，請稍後再試", status=503, code="AUTH_UNAVAILABLE") from exc
    except jwt.PyJWKClientError as exc:
        raise ApiError("登入資訊無效，請重新登入", status=401, code="INVALID_TOKEN") from exc
    return key, ASYMMETRIC_ALGORITHMS


def verify_token(token: str) -> AuthUser:
    """驗證 Supabase access token（簽章、有效期限、發行者、對象），回傳登入身分"""
    key, algorithms = _signing_key(token)
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience=AUDIENCE,
            issuer=_issuer(),
            leeway=30,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise ApiError("登入已過期，請重新登入", status=401, code="TOKEN_EXPIRED") from exc
    except jwt.InvalidTokenError as exc:
        raise ApiError("登入資訊無效，請重新登入", status=401, code="INVALID_TOKEN") from exc

    meta: dict[str, Any] = claims.get("user_metadata") or {}
    github_login = meta.get("user_name") or meta.get("preferred_username")
    return AuthUser(
        id=claims["sub"],
        email=claims.get("email") or meta.get("email") or "",
        github_login=github_login,
        name=meta.get("full_name") or meta.get("name") or github_login or "使用者",
        avatar_url=meta.get("avatar_url"),
    )


async def get_current_user(authorization: Annotated[str | None, Header()] = None) -> AuthUser:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise ApiError("請先登入", status=401, code="UNAUTHORIZED")
    return verify_token(token)


async def get_current_member(
    store: Store,
    authorization: Annotated[str | None, Header()] = None,
    x_demo_user: Annotated[str | None, Header()] = None,
) -> Member:
    """回傳開發用假成員或經 JWT 驗證的登入成員。"""
    if not authorization and x_demo_user and get_settings().app_env == "development":
        return store.find_member(x_demo_user)

    user = await get_current_user(authorization)
    return Member(
        id=user.id,
        name=user.name,
        email=user.email,
        role="Member",
        title="",
        domain="FE",
        tags=[],
        capacity=0,
        github_login=user.github_login,
        avatar_url=user.avatar_url,
    )


def require_leader(member: Member) -> None:
    """Leader 限定的操作（派工、決策等）"""
    if member.role != "Leader":
        raise ApiError("只有 Leader 可以執行這個操作", status=403, code="FORBIDDEN")


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentMember = Annotated[Member, Depends(get_current_member)]
