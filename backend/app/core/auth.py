"""登入驗證與權限。

前端以 Supabase Auth（GitHub 登入）取得 access token，放在 `Authorization: Bearer <token>`；
後端只負責驗證 token，不處理 OAuth 流程。之後若改為自行實作 GitHub OAuth，只需替換這一層。

驗證方式依 Supabase 專案的設定：
- 新的 JWT Signing Keys（ES256 / RS256）：從 `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` 取得公開金鑰，不需要密鑰
- Legacy JWT Secret（HS256）：有設定 `SUPABASE_JWT_SECRET` 時使用
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.errors import ApiError
from app.schemas.member import Member

AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]


@dataclass(frozen=True)
class AuthUser:
    """從 Supabase token 取得的登入身分（GitHub 帳號資料）"""

    id: str
    """Supabase 使用者 id（token 的 sub）"""
    email: str
    github_login: str | None
    name: str
    avatar_url: str | None


@lru_cache
def _jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    # 公開金鑰會快取，Supabase 輪替金鑰時遇到新的 kid 會自動重新抓取
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

    # GitHub 登入時 Supabase 寫入的使用者資料
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


async def get_current_member(user: Annotated[AuthUser, Depends(get_current_user)]) -> Member:
    """目前登入的成員。

    TODO（第二階段，建立 members 資料表後）：依 user.id 查詢成員，第一次登入時自動建立；
    目前先以 GitHub 身分組成成員資料，角色一律為 Member。
    """
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
    """Leader 限定的操作（派工、決策等）呼叫此函式檢查"""
    if member.role != "Leader":
        raise ApiError("只有 Leader 可以執行這個操作", status=403, code="FORBIDDEN")


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
CurrentMember = Annotated[Member, Depends(get_current_member)]
