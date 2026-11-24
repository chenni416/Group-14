"""測試用的 Supabase token：用測試金鑰簽出與 Supabase 相同格式的 JWT，不需要連線到 Supabase"""

import time
from types import SimpleNamespace
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core import auth
from app.core.config import get_settings

SUPABASE_URL = "https://test-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())
LEGACY_SECRET = "legacy-secret-for-tests-only-0123456789abcdef"


class FakeJwksClient:
    """取代 PyJWKClient：一律回傳測試用公開金鑰"""

    def get_signing_key_from_jwt(self, _token: str) -> SimpleNamespace:
        return SimpleNamespace(key=PRIVATE_KEY.public_key())


def use_fake_supabase(monkeypatch: pytest.MonkeyPatch, *, legacy_secret: str = "") -> None:
    """讓後端以測試金鑰驗證 token"""
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", legacy_secret)
    get_settings.cache_clear()
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: FakeJwksClient())


def make_token(
    *,
    sub: str = "5f0c6a8e-1d2b-4c3a-9e8f-000000000123",
    github_id: int | None = 1001,
    login: str = "octocat",
    full_name: str = "The Octocat",
    email: str = "octocat@example.com",
    avatar_url: str = "https://avatars.githubusercontent.com/u/1001",
    key: object = PRIVATE_KEY,
    alg: str = "ES256",
    **claims_overrides: Any,
) -> str:
    """Supabase GitHub 登入後簽發的 access token（user_metadata 欄位與實際相同）"""
    now = int(time.time())
    meta: dict[str, Any] = {"user_name": login, "full_name": full_name, "avatar_url": avatar_url, "email": email}
    if github_id is not None:
        meta["provider_id"] = str(github_id)
    claims: dict[str, Any] = {
        "sub": sub,
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": now + 3600,
        "iat": now,
        "email": email,
        "user_metadata": meta,
    }
    claims.update(claims_overrides)
    return jwt.encode(claims, key, algorithm=alg)


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
