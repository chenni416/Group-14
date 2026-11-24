"""GitHub API 呼叫（不需要資料庫）：App JWT、installation token 快取、分頁、state 簽章"""

import time
import uuid
from collections.abc import Iterator
from typing import Any

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import get_settings
from app.core.errors import ApiError
from app.integrations.github import client as gh
from app.integrations.github.state import STATE_TTL_SECONDS, sign_state, verify_state

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def settings(monkeypatch: pytest.MonkeyPatch, tmp_path) -> Iterator[None]:
    pem = tmp_path / "app.pem"
    pem.write_bytes(
        PRIVATE_KEY.private_bytes(
            serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
        )
    )
    monkeypatch.setenv("GITHUB_APP_ID", "12345")
    monkeypatch.setenv("GITHUB_PRIVATE_KEY_PATH", str(pem))
    monkeypatch.setenv("GITHUB_CLIENT_ID", "Iv-test")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "secret")
    get_settings.cache_clear()
    gh._private_key.cache_clear()
    gh._token_cache.clear()
    yield
    get_settings.cache_clear()
    gh._private_key.cache_clear()
    gh._token_cache.clear()


class FakeHttp:
    """取代 httpx.request／httpx.post，依 (method, path) 回傳預先設定的回應"""

    def __init__(self, routes: dict[tuple[str, str], Any]) -> None:
        self.routes = routes
        self.calls: list[tuple[str, str, dict]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        path = httpx.URL(url).path
        self.calls.append((method, path, kwargs))
        handler = self.routes[(method, path)]
        status, body = handler(kwargs) if callable(handler) else handler
        return httpx.Response(status, json=body, request=httpx.Request(method, url))

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)


def use(monkeypatch: pytest.MonkeyPatch, routes: dict) -> FakeHttp:
    fake = FakeHttp(routes)
    monkeypatch.setattr(httpx, "request", fake.request)
    monkeypatch.setattr(httpx, "post", fake.post)
    return fake


def test_app_jwt_is_signed_with_private_key() -> None:
    claims = jwt.decode(gh.app_jwt(), PRIVATE_KEY.public_key(), algorithms=["RS256"])
    assert claims["iss"] == "12345"
    assert claims["exp"] - claims["iat"] <= 600  # GitHub 規定最長 10 分鐘


def test_installation_token_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = use(monkeypatch, {("POST", "/app/installations/7/access_tokens"): (201, {"token": "ghs_1"})})
    assert gh.installation_token(7) == "ghs_1"
    assert gh.installation_token(7) == "ghs_1"
    assert len(fake.calls) == 1
    # 快過期時重新換發
    gh._token_cache[7] = ("ghs_1", time.time() + 60)
    gh.installation_token(7)
    assert len(fake.calls) == 2


def test_list_repositories_paginates(monkeypatch: pytest.MonkeyPatch) -> None:
    def repos(kwargs):
        page = kwargs["params"]["page"]
        count = 100 if page == 1 else 3
        items = [
            {
                "id": page * 1000 + i,
                "full_name": f"o/r{page}-{i}",
                "html_url": "u",
                "default_branch": "main",
                "private": False,
            }
            for i in range(count)
        ]
        return 200, {"repositories": items}

    use(
        monkeypatch,
        {
            ("POST", "/app/installations/7/access_tokens"): (201, {"token": "ghs_1"}),
            ("GET", "/installation/repositories"): repos,
        },
    )
    assert len(gh.list_installation_repositories(7)) == 103


def test_user_code_exchange_and_installations(monkeypatch: pytest.MonkeyPatch) -> None:
    use(
        monkeypatch,
        {
            ("POST", "/login/oauth/access_token"): (200, {"access_token": "ghu_1"}),
            ("GET", "/user/installations"): (200, {"installations": [{"id": 7}, {"id": 8}]}),
        },
    )
    assert gh.user_installation_ids(gh.exchange_user_code("code")) == {7, 8}


def test_bad_user_code(monkeypatch: pytest.MonkeyPatch) -> None:
    use(monkeypatch, {("POST", "/login/oauth/access_token"): (200, {"error": "bad_verification_code"})})
    with pytest.raises(ApiError) as exc:
        gh.exchange_user_code("expired")
    assert exc.value.code == "GITHUB_AUTH_FAILED"


def test_github_down(monkeypatch: pytest.MonkeyPatch) -> None:
    use(monkeypatch, {("GET", "/app/installations/7"): (503, {})})
    with pytest.raises(ApiError) as exc:
        gh.get_installation(7)
    assert exc.value.code == "GITHUB_UNAVAILABLE"


def test_missing_private_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GITHUB_PRIVATE_KEY_PATH", "/no/such/file.pem")
    get_settings.cache_clear()
    with pytest.raises(ApiError) as exc:
        gh.app_jwt()
    assert exc.value.code == "GITHUB_NOT_CONFIGURED"


def test_state_round_trip_and_expiry() -> None:
    project_id, member_id = uuid.uuid4(), uuid.uuid4()
    state = sign_state(project_id, member_id)
    assert verify_state(state) == (project_id, member_id)
    with pytest.raises(ApiError):
        verify_state(state, now=time.time() + STATE_TTL_SECONDS + 1)
