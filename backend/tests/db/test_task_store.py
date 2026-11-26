"""任務、規劃、延續事項、通知、Prompt 對話改存資料庫（repo/db_store.py：請求開始載入、成功結束才寫回）。

重點：
- 資料真的寫進資料表，重新讀取（新的請求）還在
- 請求失敗時什麼都不寫
- 專案之間互相隔離
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.llm import get_llm
from app.ai.schemas import LlmChat
from app.core.config import get_settings
from app.main import app
from app.models import BacklogItem as BacklogRow
from app.models import Notification as NotificationRow
from app.models import Sprint as SprintRow
from app.models import Task as TaskRow
from app.models import TaskChatMessage as ChatRow
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)


class FakeLlm:
    def generate_json(self, *, system: str, user: str, schema):
        assert schema is LlmChat, f"這些測試只預期 Prompt 對話會呼叫 LLM，卻要求 {schema.__name__}"
        return LlmChat(answer="這是 AI 的回答", sources=[], prompt_addition="登入使用 GitHub OAuth")

    def generate_text(self, *, system: str, user: str) -> str:
        return "這是 AI 的回答"


@pytest.fixture(autouse=True)
def setup(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    app.dependency_overrides[get_llm] = lambda: FakeLlm()
    yield
    app.dependency_overrides.pop(get_llm, None)
    get_settings.cache_clear()


def leader_headers() -> dict[str, str]:
    return bearer(make_token())


def new_project(name: str = "Taskline", prefix: str = "tl") -> tuple[dict[str, str], str]:
    """建立專案與 Sprint 1（規劃中，Capacity 20 點），回傳（標頭, Leader 的成員 id）"""
    h = leader_headers()
    pid = client.post("/api/projects", headers=h, json={"name": name, "prefix": prefix}).json()["id"]
    h = {**h, "X-Project-Id": pid}
    me = client.get("/api/me", headers=h).json()["id"]
    res = client.post(
        "/api/sprints",
        headers=h,
        json={
            "name": "Sprint 1",
            "startDate": "2026-12-01",
            "endDate": "2026-12-14",
            "goal": "完成登入",
            "capacity": {me: 20},
            "minutes": "討論登入。",
            "docs": [],
        },
    )
    assert res.status_code == 200, res.json()
    return h, me


def task_body(me: str, **over: object) -> dict:
    body = {
        "title": "實作登入",
        "domain": "BE",
        "storyPoints": 5,
        "storyPointsReason": "含 OAuth 串接",
        "assigneeId": me,
        "acceptanceCriteria": ["可以用 GitHub 登入", "登入失敗有錯誤訊息"],
        "policy": {"mode": "pool", "targets": [], "rule": "any"},
        "source": "要有登入功能",
    }
    return {**body, **over}


def add_task(h: dict[str, str], me: str, **over: object) -> dict:
    res = client.post("/api/tasks", headers=h, json=task_body(me, **over))
    assert res.status_code == 200, res.json()
    return res.json()


def count(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_task_is_persisted_and_visible_in_a_new_request(db: Session) -> None:
    h, me = new_project()
    created = add_task(h, me)
    assert created["id"] == "S-101"  # Sprint 1、不屬於任何 Story
    assert created["state"] == "DRAFT"
    assert created["assigneeId"] == me
    row = db.scalar(select(TaskRow))
    assert (row.code, row.title, row.state, row.story_points, row.domain) == ("S-101", "實作登入", "DRAFT", 5, "BE")
    assert str(row.assignee_member_id) == me
    assert row.acceptance_criteria == ["可以用 GitHub 登入", "登入失敗有錯誤訊息"]
    assert row.policy == {"mode": "pool", "targets": [], "rule": "any"}
    # 另一個請求重新從資料庫載入，內容完全相同
    assert client.get("/api/tasks", headers=h).json() == [created]


def test_task_codes_do_not_collide_and_update_delete_persist(db: Session) -> None:
    h, me = new_project()
    add_task(h, me)
    second = add_task(h, me, title="實作專案管理")
    assert second["id"] == "S-102"
    patched = client.patch(
        "/api/tasks/S-102", headers=h, json={"title": "專案管理 API", "storyPoints": 8, "assigneeId": ""}
    )
    assert patched.status_code == 200, patched.json()
    row = db.scalar(select(TaskRow).where(TaskRow.code == "S-102"))
    db.refresh(row)
    assert (row.title, row.story_points, row.assignee_member_id, row.edited) == ("專案管理 API", 8, None, True)
    assert client.delete("/api/tasks/S-101", headers=h).status_code == 204
    assert [t["id"] for t in client.get("/api/tasks", headers=h).json()] == ["S-102"]
    assert count(db, TaskRow) == 1


def test_approve_creates_notifications_and_moves_to_pending(db: Session) -> None:
    h, me = new_project()
    add_task(h, me)
    res = client.post("/api/tasks/drafts/approve", headers=h)
    assert res.status_code == 200, res.json()
    assert res.json() == {"count": 1}
    task = client.get("/api/tasks", headers=h).json()[0]
    assert task["state"] == "PENDING_MEMBER"
    note = db.scalar(select(NotificationRow))
    assert (note.type, str(note.recipient_member_id), str(note.sender_member_id)) == ("invite", me, me)
    assert note.task_id == db.scalar(select(TaskRow.id))
    assert note.status == "pending"
    assert db.scalar(select(SprintRow.planning_step)) == 5
    # 負責人在通知列表看到這則邀請：task_id 是任務編號（不是資料庫 id），並帶有任務所在的專案
    mine = client.get("/api/notifications", headers=h).json()
    assert [(n["type"], n["taskId"], n["projectId"]) for n in mine] == [("invite", "S-101", h["X-Project-Id"])]
    # 重複核准（已經沒有草稿）不會再產生通知
    assert client.post("/api/tasks/drafts/approve", headers=h).json() == {"count": 0}
    assert count(db, NotificationRow) == 1


def test_failed_request_writes_nothing(db: Session) -> None:
    """核准前檢查沒過（沒有負責人）→ 422，任務與 Sprint 都沒有被改動"""
    h, me = new_project()
    add_task(h, me)
    add_task(h, me, title="沒人做", assigneeId="")
    res = client.post("/api/tasks/drafts/approve", headers=h)
    assert res.status_code == 422
    assert res.json()["code"] == "PREFLIGHT_FAILED"
    assert {t["state"] for t in client.get("/api/tasks", headers=h).json()} == {"DRAFT"}
    assert count(db, NotificationRow) == 0
    assert db.scalar(select(SprintRow.planning_step)) == 2


def test_over_capacity_blocks_approval(db: Session) -> None:
    h, me = new_project()  # Capacity 20
    for i in range(5):
        add_task(h, me, title=f"任務 {i}", storyPoints=5)
    res = client.post("/api/tasks/drafts/approve", headers=h)
    assert res.status_code == 422
    assert "超過點數上限（25/20）" in res.json()["message"]


def test_defer_and_restore_write_backlog(db: Session) -> None:
    h, me = new_project()
    add_task(h, me)
    deferred = client.post("/api/tasks/S-101/defer", headers=h)
    assert deferred.status_code == 200, deferred.json()
    assert deferred.json()["state"] == "DEFERRED"
    item = db.scalar(select(BacklogRow))
    assert item.kind == "deferred"
    assert item.task_id == db.scalar(select(TaskRow.id))
    assert item.from_sprint_id == db.scalar(select(SprintRow.id))
    # 延續事項 API 讀到同一筆，而且連到任務編號
    listed = client.get("/api/backlog", headers=h).json()
    assert [(i["text"], i["taskId"], i["fromSprint"]) for i in listed] == [("實作登入", "S-101", "Sprint 1")]
    restored = client.post("/api/tasks/S-101/restore", headers=h)
    assert restored.status_code == 200, restored.json()
    assert restored.json()["state"] == "DRAFT"
    assert count(db, BacklogRow) == 0


def test_projects_are_isolated(db: Session) -> None:
    a, me = new_project("專案 A", "A")
    b, me_b = new_project("專案 B", "B")
    add_task(a, me)
    assert client.get("/api/tasks", headers=b).json() == []
    # 兩個專案各自從 S-101 開始，不會因為編號相同互相覆蓋
    assert add_task(b, me_b, title="B 的任務")["id"] == "S-101"
    assert [t["title"] for t in client.get("/api/tasks", headers=a).json()] == ["實作登入"]
    assert [t["title"] for t in client.get("/api/tasks", headers=b).json()] == ["B 的任務"]
    assert count(db, TaskRow) == 2


def test_task_endpoints_require_login_and_membership(db: Session) -> None:
    h, me = new_project()
    assert client.get("/api/tasks").status_code == 401
    stranger = bearer(
        make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=1999, login="stranger", email="s@example.com")
    )
    res = client.get("/api/tasks", headers={**stranger, "X-Project-Id": h["X-Project-Id"]})
    assert res.status_code == 403
    assert res.json()["code"] == "PROJECT_ACCESS_DENIED"


def test_prompt_chat_is_persisted_once(db: Session) -> None:
    """Prompt Studio：第一次開啟時產生的問候語要存起來，之後不會再多一則；提問與回答依序保存"""
    h, me = new_project()
    add_task(h, me)
    first = client.get("/api/tasks/S-101/chat", headers=h)
    assert first.status_code == 200, first.json()
    again = client.get("/api/tasks/S-101/chat", headers=h).json()
    # 訊息 id 在存進資料庫後改成資料庫的 id（第一次回應的是暫時的 "greeting"），其他內容相同
    assert [(m["role"], m["text"]) for m in again] == [(m["role"], m["text"]) for m in first.json()]
    assert len(again) == 1
    assert count(db, ChatRow) == len(again)
    reply = client.post("/api/tasks/S-101/chat", headers=h, json={"question": "登入要用哪個服務？"})
    assert reply.status_code == 200, reply.json()
    messages = client.get("/api/tasks/S-101/chat", headers=h).json()
    assert [m["role"] for m in messages[-2:]] == ["user", "assistant"]
    assert messages[-1]["text"] == "這是 AI 的回答"
    assert len(messages) == len(again) + 2
    assert messages[-1]["promptVersion"] == 2
    # Prompt 版本紀錄也存起來了：新的請求讀到同一份
    prompt = client.get("/api/tasks/S-101/prompt", headers=h)
    assert prompt.status_code == 200, prompt.json()
    assert prompt.json()["current"] == 1
    assert any("登入使用 GitHub OAuth" in line for line in prompt.json()["versions"][1])
