"""專案：列出我的專案、建立專案、取得目前專案、專案內的角色"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def create(token: str, name: str = "Taskline", prefix: str = "tl") -> dict:
    res = client.post("/api/projects", headers=bearer(token), json={"name": name, "prefix": prefix})
    assert res.status_code == 200, res.json()
    return res.json()


def test_new_member_has_no_project(db: Session) -> None:
    token = make_token()
    assert client.get("/api/projects", headers=bearer(token)).json() == []
    res = client.get("/api/project", headers=bearer(token))
    assert res.status_code == 404
    assert res.json()["code"] == "NO_PROJECT"
    assert client.get("/api/me", headers=bearer(token)).json()["role"] == "Member"


def test_create_project_makes_me_leader(db: Session) -> None:
    token = make_token()
    created = create(token)
    assert created["role"] == "Leader"
    assert created["prefix"] == "TL"  # 代碼轉成大寫
    assert client.get("/api/projects", headers=bearer(token)).json() == [created]
    project = client.get("/api/project", headers=bearer(token)).json()
    assert project["name"] == "Taskline"
    assert project["defaultPolicy"] == {"mode": "pool", "targets": [], "rule": "any"}
    assert client.get("/api/me", headers=bearer(token)).json()["role"] == "Leader"


def test_project_id_header_selects_project(db: Session) -> None:
    token = make_token()
    first = create(token, "第一個專案", "A")
    second = create(token, "第二個專案", "B")
    # 沒有指定時是最近加入的專案
    assert client.get("/api/project", headers=bearer(token)).json()["name"] == "第二個專案"
    headers = {**bearer(token), "X-Project-Id": first["id"]}
    assert client.get("/api/project", headers=headers).json()["name"] == "第一個專案"
    # 無效的專案 id 改用最近加入的專案
    headers = {**bearer(token), "X-Project-Id": "taskline"}
    assert client.get("/api/project", headers=headers).json()["name"] == second["name"]


def test_other_members_project_is_not_visible(db: Session) -> None:
    owner = make_token()
    project = create(owner)
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    headers = {**bearer(other), "X-Project-Id": project["id"]}
    assert client.get("/api/project", headers=headers).status_code == 404
    assert client.get("/api/projects", headers=bearer(other)).json() == []


def test_create_project_validation(db: Session) -> None:
    token = make_token()
    res = client.post("/api/projects", headers=bearer(token), json={"name": " ", "prefix": "TL"})
    assert res.status_code == 422
    res = client.post("/api/projects", headers=bearer(token), json={"name": "專案", "prefix": "測試"})
    assert res.status_code == 422


def test_demo_member_keeps_memory_store() -> None:
    demo = {"X-Demo-User": "m1"}
    assert client.get("/api/project", headers=demo).json()["name"] == "Taskline — 會議到交付平台"
    assert client.get("/api/projects", headers=demo).json()[0]["id"] == "taskline"
    assert client.post("/api/projects", headers=demo, json={"name": "x", "prefix": "X"}).status_code == 400
