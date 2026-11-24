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


def test_leader_updates_project(db: Session) -> None:
    token = make_token()
    create(token)
    patch = {
        "name": "新名稱",
        "goal": "新的目標",
        "prefix": "nx",
        "defaultPolicy": {"mode": "leader", "targets": [], "rule": "any"},
    }
    res = client.patch("/api/project", headers=bearer(token), json=patch)
    assert res.status_code == 200, res.json()
    project = client.get("/api/project", headers=bearer(token)).json()
    assert project["name"] == "新名稱"
    assert project["goal"] == "新的目標"
    assert project["prefix"] == "NX"
    assert project["defaultPolicy"]["mode"] == "leader"


def test_member_cannot_update_project(db: Session) -> None:
    token = make_token()
    # 還沒有專案時是 Member：不能修改
    res = client.patch("/api/project", headers=bearer(token), json={"name": "x"})
    assert res.status_code == 403


def test_members_list_and_update(db: Session) -> None:
    token = make_token()
    create(token)
    members = client.get("/api/members", headers=bearer(token)).json()
    assert len(members) == 1
    me = members[0]
    assert me["role"] == "Leader"
    patch = {"title": "資料庫負責人", "domain": "BE", "tags": ["PostgreSQL", " "], "capacity": 0}
    res = client.patch(f"/api/members/{me['id']}", headers=bearer(token), json=patch)
    assert res.status_code == 200, res.json()
    updated = client.get("/api/members", headers=bearer(token)).json()[0]
    assert updated["title"] == "資料庫負責人"
    assert updated["domain"] == "BE"
    assert updated["tags"] == ["PostgreSQL"]  # 空白標籤被移除
    assert updated["capacity"] == 1  # 容量至少 1


def test_last_leader_cannot_step_down(db: Session) -> None:
    token = make_token()
    create(token)
    me = client.get("/api/members", headers=bearer(token)).json()[0]
    res = client.patch(f"/api/members/{me['id']}", headers=bearer(token), json={"role": "Member"})
    assert res.status_code == 422


def test_members_of_other_projects_are_not_visible(db: Session) -> None:
    owner = make_token()
    create(owner)
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    create(other, "別人的專案", "OT")
    names = [m["name"] for m in client.get("/api/members", headers=bearer(other)).json()]
    assert names == ["hubot"]


def test_knowledge_docs(db: Session) -> None:
    token = make_token()
    create(token)
    assert client.get("/api/docs", headers=bearer(token)).json() == []
    res = client.post("/api/docs", headers=bearer(token), json={"files": [{"name": "PRD_v2.md", "size": 2500000}]})
    assert res.status_code == 200, res.json()
    assert res.json()[0]["kind"] == "PRD"
    assert res.json()[0]["size"] == "2.5 MB"
    link = client.post("/api/docs/links", headers=bearer(token), json={"url": "https://www.figma.com/file/abc"}).json()
    assert link["kind"] == "Figma"
    assert link["isLink"] is True
    docs = client.get("/api/docs", headers=bearer(token)).json()
    assert [d["name"] for d in docs] == ["PRD_v2.md", "www.figma.com/file/abc"]
    assert client.delete(f"/api/docs/{link['id']}", headers=bearer(token)).status_code == 204
    assert len(client.get("/api/docs", headers=bearer(token)).json()) == 1


def test_link_needs_http_url(db: Session) -> None:
    token = make_token()
    create(token)
    res = client.post("/api/docs/links", headers=bearer(token), json={"url": "not a url"})
    assert res.status_code == 422


def test_docs_of_other_projects_are_not_visible(db: Session) -> None:
    owner = make_token()
    create(owner)
    doc = client.post("/api/docs", headers=bearer(owner), json={"files": [{"name": "README.md", "size": 100}]}).json()[
        0
    ]
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    create(other, "別人的專案", "OT")
    assert client.get("/api/docs", headers=bearer(other)).json() == []
    assert client.delete(f"/api/docs/{doc['id']}", headers=bearer(other)).status_code == 404


def test_git_integration_option(db: Session) -> None:
    token = make_token()
    create(token)
    assert client.get("/api/project", headers=bearer(token)).json()["gitIntegration"] is False
    res = client.patch("/api/project", headers=bearer(token), json={"gitIntegration": True})
    assert res.status_code == 200
    assert client.get("/api/project", headers=bearer(token)).json()["gitIntegration"] is True


def test_organization_comes_from_project(db: Session) -> None:
    token = make_token()
    create(token, "Taskline", "TL")
    org = client.get("/api/organization", headers=bearer(token)).json()
    assert org["name"] == "Taskline"
    assert org["teams"] == [{"name": "Taskline", "memberCount": 1, "current": True}]


@pytest.mark.parametrize("length", ["1 天", "6 天", "1 週", "4 週", " 3 天 "])
def test_sprint_length_accepts_days_and_weeks(db: Session, length: str) -> None:
    token = make_token()
    res = client.post("/api/projects", headers=bearer(token), json={"name": "X", "prefix": "X", "sprintLength": length})
    assert res.status_code == 200, res.json()
    assert client.get("/api/project", headers=bearer(token)).json()["sprintLength"] == length.strip()


@pytest.mark.parametrize("length", ["0 天", "7 天", "0 週", "5 週", "1 月", "兩週", "2週", ""])
def test_sprint_length_out_of_range(db: Session, length: str) -> None:
    token = make_token()
    create(token)
    res = client.patch("/api/project", headers=bearer(token), json={"sprintLength": length})
    assert res.status_code == 422
    assert client.get("/api/project", headers=bearer(token)).json()["sprintLength"] == "2 週"
