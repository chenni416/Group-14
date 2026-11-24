"""通知：邀請與邀請碼的各個事件會通知對的人，可以標為已讀"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.services import invitations
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)
HUBOT = {"sub": "5f0c6a8e-1d2b-4c3a-9e8f-000000000999", "github_id": 2002, "login": "hubot"}


@pytest.fixture(autouse=True)
def fake_github(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    monkeypatch.setattr(invitations, "lookup_github_user", lambda login: 2002 if login == "hubot" else None)
    yield
    get_settings.cache_clear()


def leader() -> str:
    token = make_token()
    res = client.post("/api/projects", headers=bearer(token), json={"name": "Taskline", "prefix": "TL"})
    assert res.status_code == 200, res.json()
    return token


def texts(token: str) -> list[str]:
    return [n["text"] for n in client.get("/api/notifications", headers=bearer(token)).json()]


def test_invitation_before_first_login_is_backfilled(db: Session) -> None:
    lead = leader()
    client.post("/api/invitations", headers=bearer(lead), json={"githubLogin": "hubot"})
    # hubot 還沒登入過：第一次讀通知時補上
    hubot = make_token(**HUBOT)
    notes = client.get("/api/notifications", headers=bearer(hubot)).json()
    assert [n["text"] for n in notes] == ["octocat 邀請你加入「Taskline」"]
    assert notes[0]["type"] == "invite"
    assert notes[0]["link"] == "/projects/join"
    # 再讀一次不會重複補
    assert len(texts(hubot)) == 1


def test_accept_notifies_inviter_and_closes_invite(db: Session) -> None:
    lead = leader()
    hubot = make_token(**HUBOT)
    client.get("/api/me", headers=bearer(hubot))  # hubot 先登入過：邀請時直接通知
    inv = client.post("/api/invitations", headers=bearer(lead), json={"githubLogin": "hubot"}).json()
    assert texts(hubot) == ["octocat 邀請你加入「Taskline」"]

    client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(hubot))
    assert client.get("/api/notifications", headers=bearer(hubot)).json()[0]["status"] == "done"
    lead_notes = client.get("/api/notifications", headers=bearer(lead)).json()
    assert lead_notes[0]["text"] == "hubot 接受了你的邀請，加入「Taskline」"
    assert lead_notes[0]["link"] == "/team"
    assert lead_notes[0]["projectId"] == inv["projectId"]


def test_decline_notifies_inviter(db: Session) -> None:
    lead = leader()
    hubot = make_token(**HUBOT)
    inv = client.post("/api/invitations", headers=bearer(lead), json={"githubLogin": "hubot"}).json()
    client.post(f"/api/invitations/{inv['id']}/decline", headers=bearer(hubot))
    assert texts(lead) == ["hubot 拒絕了加入「Taskline」的邀請"]


def test_join_request_notifies_leader_then_applicant(db: Session) -> None:
    lead = leader()
    code = client.post("/api/join-codes", headers=bearer(lead), json={}).json()["code"]
    hubot = make_token(**HUBOT)
    req = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()
    assert texts(lead) == ["hubot 申請加入「Taskline」"]

    client.post(f"/api/join-requests/{req['id']}/approve", headers=bearer(lead))
    note = client.get("/api/notifications", headers=bearer(hubot)).json()[0]
    assert note["text"] == "你已加入「Taskline」"
    assert note["link"] == "/"
    assert client.get("/api/notifications", headers=bearer(lead)).json()[0]["status"] == "done"


def test_reject_notifies_applicant(db: Session) -> None:
    lead = leader()
    code = client.post("/api/join-codes", headers=bearer(lead), json={}).json()["code"]
    hubot = make_token(**HUBOT)
    req = client.post("/api/join-requests", headers=bearer(hubot), json={"code": code}).json()
    client.post(f"/api/join-requests/{req['id']}/reject", headers=bearer(lead))
    note = client.get("/api/notifications", headers=bearer(hubot)).json()[0]
    assert note["text"] == "「Taskline」的 Leader 拒絕了你的加入申請"
    assert note["link"] is None


def test_mark_read(db: Session) -> None:
    lead = leader()
    hubot = make_token(**HUBOT)
    client.post("/api/invitations", headers=bearer(lead), json={"githubLogin": "hubot"})
    note = client.get("/api/notifications", headers=bearer(hubot)).json()[0]
    # 別人不能標記
    assert client.post(f"/api/notifications/{note['id']}/read", headers=bearer(lead)).status_code == 404
    assert client.post(f"/api/notifications/{note['id']}/read", headers=bearer(hubot)).status_code == 204
    assert client.get("/api/notifications", headers=bearer(hubot)).json()[0]["status"] == "done"
    assert client.post("/api/notifications/read-all", headers=bearer(hubot)).status_code == 204
