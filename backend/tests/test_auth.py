"""登入驗證（token 本身）：不需要資料庫。成員的建立與更新見 tests/db/test_members.py"""

import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.auth import verify_token
from app.core.config import get_settings
from app.core.errors import ApiError
from app.main import app
from tests.auth_helpers import LEGACY_SECRET, OTHER_KEY, bearer, make_token, use_fake_supabase

client = TestClient(app)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def test_verify_token_reads_github_identity() -> None:
    user = verify_token(make_token())
    assert user.id == "5f0c6a8e-1d2b-4c3a-9e8f-000000000123"
    assert user.github_id == 1001
    assert user.github_login == "octocat"
    assert user.email == "octocat@example.com"
    assert user.avatar_url == "https://avatars.githubusercontent.com/u/1001"


def test_verify_token_without_github_id() -> None:
    assert verify_token(make_token(github_id=None)).github_id is None


def test_missing_token() -> None:
    res = client.get("/api/me")
    assert (res.status_code, res.json()) == (401, {"code": "UNAUTHORIZED", "message": "請先登入"})


def test_expired_token() -> None:
    res = client.get("/api/me", headers=bearer(make_token(exp=int(time.time()) - 3600)))
    assert (res.status_code, res.json()["code"]) == (401, "TOKEN_EXPIRED")


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
    res = client.get("/api/me", headers=bearer(token()))
    assert (res.status_code, res.json()["code"]) == (401, "INVALID_TOKEN")


def test_legacy_jwt_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    use_fake_supabase(monkeypatch, legacy_secret=LEGACY_SECRET)
    assert verify_token(make_token(key=LEGACY_SECRET, alg="HS256")).github_login == "octocat"


def test_legacy_token_rejected_with_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    use_fake_supabase(monkeypatch, legacy_secret=LEGACY_SECRET)
    with pytest.raises(ApiError) as exc:
        verify_token(make_token(key="another-secret-for-tests-0123456789abcdef", alg="HS256"))
    assert exc.value.code == "INVALID_TOKEN"
