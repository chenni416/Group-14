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
    # 格式不正確的專案 id（例如示範專案的 "taskline"）不會被偷偷換成別的專案
    headers = {**bearer(token), "X-Project-Id": "taskline"}
    res = client.get("/api/project", headers=headers)
    assert (res.status_code, res.json()["code"]) == (400, "INVALID_PROJECT_ID")
    assert second["id"] != first["id"]


def test_other_members_project_is_not_visible(db: Session) -> None:
    owner = make_token()
    project = create(owner)
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    headers = {**bearer(other), "X-Project-Id": project["id"]}
    res = client.get("/api/project", headers=headers)
    assert (res.status_code, res.json()["code"]) == (403, "PROJECT_ACCESS_DENIED")
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


# ---------- X-Project-Id 明確報錯：不會偷偷改用別的專案 ----------

PROJECT_SCOPED = ["/api/project", "/api/organization", "/api/members", "/api/docs"]
ACCOUNT_LEVEL = ["/api/me", "/api/projects", "/api/invitations/mine", "/api/join-requests/mine", "/api/notifications"]


def with_project(token: str, project_id: str) -> dict[str, str]:
    return {**bearer(token), "X-Project-Id": project_id}


def test_unknown_project_id_is_rejected_on_project_scoped_endpoints(db: Session) -> None:
    """格式正確但不存在的專案：回 403，而不是改用我最近加入的專案"""
    token = make_token()
    create(token)
    ghost = "00000000-0000-4000-8000-000000000001"
    for path in PROJECT_SCOPED:
        res = client.get(path, headers=with_project(token, ghost))
        assert (res.status_code, res.json()["code"]) == (403, "PROJECT_ACCESS_DENIED"), path
    # 不存在與「存在但我不是成員」的回應相同，不洩漏專案是否存在
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    theirs = create(other, "別人的專案", "X")
    res = client.get("/api/project", headers=with_project(token, theirs["id"]))
    assert (res.status_code, res.json()["message"]) == (403, "你不是這個專案的成員，或專案已不存在")


def test_write_endpoints_also_reject_invalid_project(db: Session) -> None:
    """寫入也一樣：不會把資料寫進另一個專案"""
    token = make_token()
    create(token)
    ghost = with_project(token, "00000000-0000-4000-8000-000000000001")
    res = client.patch("/api/project", headers=ghost, json={"goal": "不該寫入"})
    assert res.status_code in (400, 403)
    assert client.get("/api/project", headers=bearer(token)).json()["goal"] != "不該寫入"


def test_account_level_endpoints_ignore_invalid_project_id(db: Session) -> None:
    """帳號層級的端點不能因為舊的專案 id 而失敗：前端要靠它們重新讀取專案清單，才能從失效復原"""
    token = make_token()
    mine = create(token)
    for bad in ["taskline", "00000000-0000-4000-8000-000000000001", ""]:
        for path in ACCOUNT_LEVEL:
            res = client.get(path, headers=with_project(token, bad))
            assert res.status_code == 200, (path, bad, res.json())
        assert client.get("/api/projects", headers=with_project(token, bad)).json() == [mine]
    # 專案 id 無效時，帳號層級的端點把我視為一般成員（沒有專案角色）
    assert client.get("/api/me", headers=with_project(token, "taskline")).json()["role"] == "Member"
    # 仍然可以在失效的狀態下建立新專案
    res = client.post("/api/projects", headers=with_project(token, "taskline"), json={"name": "新專案", "prefix": "N"})
    assert res.status_code == 200


def test_deleted_project_id_is_rejected_then_recoverable(db: Session) -> None:
    """專案被刪除後，舊的專案 id 回 403；前端清掉 id 後（不帶標頭）可以回到剩下的專案"""
    token = make_token()
    keep = create(token, "保留的專案", "K")
    doomed = create(token, "要刪除的專案", "D")
    gone = with_project(token, doomed["id"])
    assert (
        client.request("DELETE", "/api/project", headers=gone, json={"confirmName": "要刪除的專案"}).status_code == 204
    )
    res = client.get("/api/project", headers=gone)
    assert (res.status_code, res.json()["code"]) == (403, "PROJECT_ACCESS_DENIED")
    assert client.get("/api/projects", headers=gone).json() == [keep]
    assert client.get("/api/project", headers=bearer(token)).json()["name"] == "保留的專案"


def test_non_member_gets_403_with_someone_elses_project_id(db: Session) -> None:
    """不是成員的人拿別人專案的 id 呼叫：403（帳號仍可使用）"""
    owner = make_token()
    pid = create(owner)["id"]
    other = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
    assert client.get("/api/project", headers=with_project(other, pid)).status_code == 403
    assert client.get("/api/me", headers=with_project(other, pid)).status_code == 200
