"""邀請碼加入：產生與停用邀請碼、送出申請、Leader 同意或拒絕"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

# 申請加入的人
HUBOT = {"sub": "5f0c6a8e-1d2b-4c3a-9e8f-000000000999", "github_id": 2002, "login": "hubot"}


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def leader_with_code() -> tuple[str, str]:
    """建立專案並產生邀請碼，回傳 (Leader 的 token, 邀請碼)"""
    token = make_token()
    assert (
        client.post("/api/projects", headers=bearer(token), json={"name": "Taskline", "prefix": "TL"}).status_code
        == 200
    )
    res = client.post("/api/join-codes", headers=bearer(token), json={})
    assert res.status_code == 200, res.json()
    return token, res.json()["code"]


def test_code_request_approve(db: Session) -> None:
    leader, code = leader_with_code()
    assert code.startswith("TL-") and len(code) == 9
    assert client.get("/api/join-codes/current", headers=bearer(leader)).json()["code"] == code

    hubot = make_token(**HUBOT)
    res = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code.lower()})  # 不分大小寫
    assert res.status_code == 200, res.json()
    assert res.json()["projectName"] == "Taskline"
    assert len(client.get("/api/join-requests/mine", headers=bearer(hubot)).json()) == 1

    pending = client.get("/api/join-requests", headers=bearer(leader)).json()
    assert [r["githubLogin"] for r in pending] == ["hubot"]
    assert client.post(f"/api/join-requests/{pending[0]['id']}/approve", headers=bearer(leader)).status_code == 204

    members = client.get("/api/members", headers=bearer(leader)).json()
    assert any(m["githubLogin"] == "hubot" and m["role"] == "Member" for m in members)
    assert client.get("/api/join-requests", headers=bearer(leader)).json() == []
    assert client.get("/api/join-requests/mine", headers=bearer(hubot)).json() == []


def test_reject_and_cancel(db: Session) -> None:
    leader, code = leader_with_code()
    hubot = make_token(**HUBOT)
    req = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()
    assert (
        client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()["code"]
        == "ALREADY_REQUESTED"
    )
    assert client.post(f"/api/join-requests/{req['id']}/reject", headers=bearer(leader)).status_code == 204
    assert len(client.get("/api/members", headers=bearer(leader)).json()) == 1

    # 被拒絕後可以再申請，也可以自己取消
    again = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()
    assert client.delete(f"/api/join-requests/{again['id']}", headers=bearer(hubot)).status_code == 204
    assert client.get("/api/join-requests", headers=bearer(leader)).json() == []


def test_new_code_replaces_old_and_revoke(db: Session) -> None:
    leader, old = leader_with_code()
    new = client.post("/api/join-codes", headers=bearer(leader), json={"expiresInDays": None}).json()
    assert new["code"] != old
    assert new["expiresAt"] is None
    hubot = make_token(**HUBOT)
    assert (
        client.post("/api/join-requests", headers=bearer(hubot), json={"code": old}).json()["code"]
        == "INVALID_JOIN_CODE"
    )

    assert client.delete("/api/join-codes/current", headers=bearer(leader)).status_code == 204
    assert client.get("/api/join-codes/current", headers=bearer(leader)).json() is None
    assert client.post("/api/join-requests", headers=bearer(hubot), json={"code": new["code"]}).status_code == 404


def test_rules(db: Session) -> None:
    leader, code = leader_with_code()
    # Leader 自己已經是成員
    assert (
        client.post("/api/join-requests", headers=bearer(leader), json={"code": code}).json()["code"]
        == "ALREADY_MEMBER"
    )
    assert client.post("/api/join-codes", headers=bearer(leader), json={"expiresInDays": 99}).status_code == 422
    # 別人不能審核、不能取消不是自己的申請
    hubot = make_token(**HUBOT)
    req = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()
    mallory = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000777", github_id=3003, login="mallory")
    assert client.delete(f"/api/join-requests/{req['id']}", headers=bearer(mallory)).status_code == 404
    assert client.post(f"/api/join-requests/{req['id']}/approve", headers=bearer(mallory)).status_code in (403, 404)
