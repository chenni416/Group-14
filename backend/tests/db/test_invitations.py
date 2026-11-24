"""成員邀請（指定 GitHub 帳號）：建立、列出、撤銷、接受、拒絕"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.services import invitations
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

# 被邀請的人：GitHub 帳號 Hubot，id 2002
HUBOT = {"sub": "5f0c6a8e-1d2b-4c3a-9e8f-000000000999", "github_id": 2002, "login": "Hubot"}


@pytest.fixture(autouse=True)
def fake_github(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    # 不連到真的 GitHub：hubot 存在（id 2002），ghost 不存在

    def lookup(login: str) -> int | None:
        if login == "ghost":
            raise invitations.ApiError("找不到 GitHub 帳號 @ghost", status=422, code="GITHUB_USER_NOT_FOUND")
        return 2002 if login == "hubot" else None

    monkeypatch.setattr(invitations, "lookup_github_user", lookup)
    yield
    get_settings.cache_clear()


def leader_with_project() -> str:
    token = make_token()
    res = client.post("/api/projects", headers=bearer(token), json={"name": "Taskline", "prefix": "TL"})
    assert res.status_code == 200, res.json()
    return token


def invite(token: str, login: str = "@Hubot", **extra: object):
    return client.post("/api/invitations", headers=bearer(token), json={"githubLogin": login, **extra})


def test_invite_accept_and_join(db: Session) -> None:
    leader = leader_with_project()
    res = invite(leader, title="前端工程師", domain="FE", capacity=8)
    assert res.status_code == 200, res.json()
    inv = res.json()
    assert inv["githubLogin"] == "hubot"  # 去掉 @、轉小寫
    assert inv["status"] == "pending"
    assert inv["invitedByName"] == "octocat"

    hubot = make_token(**HUBOT)
    mine = client.get("/api/invitations/mine", headers=bearer(hubot)).json()
    assert [i["projectName"] for i in mine] == ["Taskline"]

    res = client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(hubot))
    assert res.status_code == 200, res.json()
    assert res.json()["projectId"] == inv["projectId"]

    members = client.get("/api/members", headers=bearer(leader)).json()
    joined = next(m for m in members if m["githubLogin"] == "Hubot")
    assert joined["role"] == "Member"
    assert joined["title"] == "前端工程師"
    assert joined["capacity"] == 8
    assert client.get("/api/invitations/mine", headers=bearer(hubot)).json() == []
    assert client.get("/api/invitations", headers=bearer(leader)).json()[0]["status"] == "accepted"


def test_only_invited_account_can_accept(db: Session) -> None:
    leader = leader_with_project()
    inv = invite(leader).json()
    stranger = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000777", github_id=3003, login="mallory")
    assert client.get("/api/invitations/mine", headers=bearer(stranger)).json() == []
    assert client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(stranger)).status_code == 404


def test_decline_and_revoke(db: Session) -> None:
    leader = leader_with_project()
    inv = invite(leader).json()
    hubot = make_token(**HUBOT)
    assert client.post(f"/api/invitations/{inv['id']}/decline", headers=bearer(hubot)).status_code == 204
    assert client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(hubot)).status_code == 409

    again = invite(leader).json()  # 拒絕後可以再邀請
    assert client.delete(f"/api/invitations/{again['id']}", headers=bearer(leader)).status_code == 204
    assert client.get("/api/invitations/mine", headers=bearer(hubot)).json() == []


def test_invite_rules(db: Session) -> None:
    leader = leader_with_project()
    assert invite(leader, "not a login!").status_code == 422
    assert invite(leader, "ghost").json()["code"] == "GITHUB_USER_NOT_FOUND"
    assert invite(leader).status_code == 200
    assert invite(leader).json()["code"] == "ALREADY_INVITED"
    assert invite(leader, "octocat").json()["code"] == "ALREADY_MEMBER"


def test_member_cannot_invite(db: Session) -> None:
    leader = leader_with_project()
    inv = invite(leader).json()
    hubot = make_token(**HUBOT)
    client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(hubot))
    headers = {**bearer(hubot), "X-Project-Id": inv["projectId"]}
    assert client.post("/api/invitations", headers=headers, json={"githubLogin": "someone"}).status_code == 403
