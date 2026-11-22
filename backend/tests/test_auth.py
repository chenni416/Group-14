"""登入驗證：用測試金鑰簽出 Supabase 格式的 token，不需要連線到 Supabase"""

import time
from collections.abc import Iterator
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import get_settings
from app.main import app

SUPABASE_URL = "https://test-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())
LEGACY_SECRET = "legacy-secret-for-tests-only-0123456789abcdef"

client = TestClient(app)


class FakeJwksClient:
    """取代 PyJWKClient：一律回傳測試用公開金鑰"""

    def get_signing_key_from_jwt(self, _token: str) -> SimpleNamespace:
        return SimpleNamespace(key=PRIVATE_KEY.public_key())


@pytest.fixture(autouse=True)
def settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("SUPABASE_URL", SUPABASE_URL)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "")
    get_settings.cache_clear()
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: FakeJwksClient())
    yield
    get_settings.cache_clear()


def make_token(key: object = PRIVATE_KEY, alg: str = "ES256", **overrides: object) -> str:
    now = int(time.time())
    claims = {
        "sub": "user-123",
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": now + 3600,
        "iat": now,
        "email": "octocat@example.com",
        "user_metadata": {
            "user_name": "octocat",
            "full_name": "The Octocat",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
        },
    }
    claims.update(overrides)
    return jwt.encode(claims, key, algorithm=alg)


def get_me(token: str | None) -> tuple[int, dict]:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    res = client.get("/api/me", headers=headers)
    return res.status_code, res.json()


def test_me_returns_github_identity() -> None:
    status, body = get_me(make_token())
    assert status == 200
    assert body["id"] == "user-123"
    assert body["name"] == "The Octocat"
    assert body["email"] == "octocat@example.com"
    assert body["githubLogin"] == "octocat"
    assert body["avatarUrl"] == "https://avatars.githubusercontent.com/u/1"


def test_missing_token() -> None:
    assert get_me(None) == (401, {"code": "UNAUTHORIZED", "message": "請先登入"})


def test_expired_token() -> None:
    status, body = get_me(make_token(exp=int(time.time()) - 3600))
    assert (status, body["code"]) == (401, "TOKEN_EXPIRED")


@pytest.mark.parametrize(
    "token",
    [
        pytest.param(lambda: make_token(key=OTHER_KEY), id="forged-signature"),
        pytest.param(lambda: make_token(iss="https://other.supabase.co/auth/v1"), id="wrong-issuer"),
        pytest.param(lambda: make_token(aud="anon"), id="wrong-audience"),
        pytest.param(lambda: make_token(key=LEGACY_SECRET, alg="HS256"), id="hs256-without-secret"),
        pytest.param(lambda: "not-a-jwt", id="malformed"),
    ],
)
def test_rejects_invalid_token(token) -> None:
    status, body = get_me(token())
    assert (status, body["code"]) == (401, "INVALID_TOKEN")


def test_legacy_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", LEGACY_SECRET)
    get_settings.cache_clear()
    status, body = get_me(make_token(key=LEGACY_SECRET, alg="HS256"))
    assert status == 200
    assert body["githubLogin"] == "octocat"
