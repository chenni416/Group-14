"""整段流程（資料庫版）：建立專案 → 邀請成員 → 建 Sprint 1 → 派工 → 成員接受 → 啟動 → 開發 → 送審 → 審查通過
→ 結束 → 建 Sprint 2（帶入未完成任務）→ 啟動。

規劃的 AI 拆解用手動新增任務代替（不需要 LLM）；其餘每一步都走真實的 API 與資料表。
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.models import BacklogItem as BacklogRow
from app.models import Notification as NotificationRow
from app.models import Sprint as SprintRow
from app.models import Task as TaskRow
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

HUBOT = {
    "sub": "5f0c6a8e-1d2b-4c3a-9e8f-000000000456",
    "github_id": 1002,
    "login": "Hubot",
    "email": "hubot@example.com",
}
DELIVERY = {
    "prUrl": "https://github.com/acme/taskline/pull/12",
    "deliverables": [{"text": "實作", "provided": True}],
    "testNote": "單元測試通過",
    "unfinished": "",
    "questions": "",
}
POOL = {"mode": "pool", "targets": [], "rule": "any"}
LEADER_POLICY = {"mode": "leader", "targets": [], "rule": "any"}


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


class Team:
    """一個專案：Leader（octocat）與成員 Hubot"""

    def __init__(self) -> None:
        leader = bearer(make_token())
        pid = client.post("/api/projects", headers=leader, json={"name": "Taskline", "prefix": "tl"}).json()["id"]
        self.lead = {**leader, "X-Project-Id": pid}
        self.lead_id = client.get("/api/me", headers=self.lead).json()["id"]
        hubot = bearer(make_token(**HUBOT))
        self.hubot_id = client.get("/api/me", headers=hubot).json()["id"]  # 第一次登入
        inv = client.post("/api/invitations", headers=self.lead, json={"githubLogin": "@Hubot"}).json()
        assert client.post(f"/api/invitations/{inv['id']}/accept", headers=hubot).status_code == 200
        self.bot = {**hubot, "X-Project-Id": pid}

    def sprint(self, name: str, start: str, end: str, minutes: str = "") -> dict:
        res = client.post(
            "/api/sprints",
            headers=self.lead,
            json={
                "name": name,
                "startDate": start,
                "endDate": end,
                "goal": "目標",
                "capacity": {self.lead_id: 20, self.hubot_id: 20},
                "minutes": minutes,
                "docs": [],
            },
        )
        assert res.status_code == 200, res.json()
        return res.json()

    def task(self, title: str, assignee: str, points: int = 3, policy: dict | None = None) -> str:
        res = client.post(
            "/api/tasks",
            headers=self.lead,
            json={
                "title": title,
                "domain": "BE",
                "storyPoints": points,
                "storyPointsReason": "",
                "assigneeId": assignee,
                "acceptanceCriteria": ["符合需求"],
                "policy": policy or POOL,
                "source": "",
            },
        )
        assert res.status_code == 200, res.json()
        return res.json()["id"]

    def state(self, task_id: str) -> str:
        return next(t["state"] for t in client.get("/api/tasks", headers=self.lead).json() if t["id"] == task_id)


def post(headers: dict, url: str, body: dict | None = None):
    return client.post(url, headers=headers, json=body) if body is not None else client.post(url, headers=headers)


def sprint_statuses(team: Team) -> dict[int, str]:
    return {s["id"]: s["status"] for s in client.get("/api/sprints", headers=team.lead).json()}


def test_full_flow_sprint_1_to_sprint_2(db: Session) -> None:
    team = Team()
    s1 = team.sprint("Sprint 1", "2026-12-01", "2026-12-14", minutes="Sprint 1 會議紀錄")
    assert s1["status"] == "planning"
    # 專案資料要帶有規劃中的 Sprint：前端靠它在重新整理後回到規劃中的 Sprint
    project = client.get("/api/project", headers=team.lead).json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (0, 1)

    # ---- 規劃：4 個任務，不同的審查策略 ----
    a = team.task("登入 API", team.hubot_id, 3, LEADER_POLICY)
    b = team.task("專案管理 API", team.hubot_id, 5, POOL)
    c = team.task("Leader 的任務", team.lead_id, 3, {"mode": "target", "targets": [team.hubot_id], "rule": "any"})
    d = team.task("匯出報表", team.hubot_id, 2, LEADER_POLICY)
    assert post(team.lead, "/api/tasks/drafts/approve").json() == {"count": 4}

    # ---- 成員接受：還沒全部接受前不能啟動 ----
    notes = client.get("/api/notifications", headers=team.bot).json()
    assert sorted(n["taskId"] for n in notes if n["type"] == "invite" and n["taskId"]) == sorted([a, b, d])
    early = post(team.lead, f"/api/sprints/{s1['id']}/start")
    assert early.status_code == 409
    assert early.json()["code"] == "SPRINT_NOT_READY"
    assert post(team.lead, f"/api/tasks/{a}/accept").status_code == 403  # Leader 不是 A 的負責人
    for task_id in (a, b, d):
        assert post(team.bot, f"/api/tasks/{task_id}/accept").json()["state"] == "ASSIGNED"
    assert post(team.lead, f"/api/tasks/{c}/accept").json()["state"] == "ASSIGNED"
    assert [
        n["status"]
        for n in client.get("/api/notifications", headers=team.bot).json()
        if n["type"] == "invite" and n["taskId"]
    ] == ["done"] * 3

    # ---- 啟動 Sprint 1 ----
    assert post(team.bot, f"/api/sprints/{s1['id']}/start").status_code == 403  # 只有 Leader
    started = post(team.lead, f"/api/sprints/{s1['id']}/start")
    assert started.status_code == 200, started.json()
    assert started.json() == {"carriedOver": 0, "deferred": 0}
    assert sprint_statuses(team) == {1: "active"}
    project = client.get("/api/project", headers=team.lead).json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (1, None)
    assert {team.state(t) for t in (a, b, c, d)} == {"TODO"}
    assert post(team.lead, f"/api/sprints/{s1['id']}/start").status_code == 409  # 已經啟動

    # ---- 開發 → 送審 → 要求修改 → 再送審 → 通過（A：Leader 審查）----
    assert post(team.lead, f"/api/tasks/{a}/start").status_code == 403  # 不是負責人
    assert post(team.bot, f"/api/tasks/{a}/start").json()["state"] == "IN_PROGRESS"
    assert post(team.bot, f"/api/tasks/{a}/start").status_code == 409  # 已經在開發
    sent = post(team.bot, f"/api/tasks/{a}/review", DELIVERY)
    assert sent.status_code == 200, sent.json()
    assert (sent.json()["state"], sent.json()["reviewerId"]) == ("IN_REVIEW", team.lead_id)
    assert sent.json()["delivery"]["prUrl"] == DELIVERY["prUrl"]
    assert post(team.bot, f"/api/tasks/{a}/review/approve", {}).status_code == 403  # 負責人不能審查自己
    assert post(team.lead, f"/api/tasks/{a}/review/request-changes", {"note": " "}).status_code == 422
    changes = post(team.lead, f"/api/tasks/{a}/review/request-changes", {"note": "缺少錯誤處理"})
    assert (changes.json()["state"], changes.json()["reviewerId"]) == ("IN_PROGRESS", None)
    assert any(n["text"] == "要求修改：缺少錯誤處理" for n in client.get("/api/notifications", headers=team.bot).json())
    post(team.bot, f"/api/tasks/{a}/review", DELIVERY)
    approved = post(team.lead, f"/api/tasks/{a}/review/approve", {})
    assert approved.json() == {"completed": True, "approvals": 0, "required": 0}
    assert team.state(a) == "DONE"

    # ---- B：公共池，Leader 認領後通過；負責人不能認領 ----
    post(team.bot, f"/api/tasks/{b}/start")
    post(team.bot, f"/api/tasks/{b}/review", DELIVERY)
    pool = [n for n in client.get("/api/notifications", headers=team.lead).json() if n["type"] == "pool"]
    assert [n["taskId"] for n in pool] == [b]
    assert post(team.bot, f"/api/tasks/{b}/review/claim").status_code == 403
    assert post(team.lead, f"/api/tasks/{b}/review/approve", {}).status_code == 403  # 還沒認領
    claimed = post(team.lead, f"/api/tasks/{b}/review/claim")
    assert claimed.json()["reviewerId"] == team.lead_id
    assert post(team.lead, f"/api/tasks/{b}/review/claim").status_code == 409  # 已被認領
    assert post(team.lead, f"/api/tasks/{b}/review/approve", {}).json()["completed"] is True

    # ---- C：Leader 自己的任務，指定 Hubot 審查 ----
    post(team.lead, f"/api/tasks/{c}/start")
    post(team.lead, f"/api/tasks/{c}/review", DELIVERY)
    assert post(team.lead, f"/api/tasks/{c}/review/approve", {}).status_code == 403
    assert post(team.bot, f"/api/tasks/{c}/review/approve", {}).json()["completed"] is True

    # ---- 結束 Sprint 1：D 沒做完 ----
    assert post(team.bot, f"/api/sprints/{s1['id']}/end").status_code == 403
    ended = post(team.lead, f"/api/sprints/{s1['id']}/end")
    assert ended.json() == {"unfinished": 1}
    closed = client.get("/api/sprints", headers=team.lead).json()[0]
    assert (closed["status"], closed["summary"]) == ("closed", {"total": 13, "done": 11, "tasks": 4})
    assert post(team.lead, f"/api/sprints/{s1['id']}/end").status_code == 409  # 已經結束
    # 結束後到下一個 Sprint 啟動前，目前的 Sprint 仍是剛結束的那個（前端的 Active Board 靠它顯示完成度與回顧，不能是 0）
    project = client.get("/api/project", headers=team.lead).json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (1, None)

    # ---- Sprint 2：建立、帶入 D、新任務、啟動 ----
    defaults = client.get("/api/sprints/defaults", headers=team.lead).json()
    assert (defaults["id"], defaults["startDate"]) == (2, "2026-12-15")
    s2 = team.sprint("Sprint 2", defaults["startDate"], defaults["endDate"])
    assert s2["id"] == 2
    project = client.get("/api/project", headers=team.lead).json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (1, 2)
    kept = client.put(
        f"/api/tasks/{d}/carry", headers=team.lead, json={"carry": True, "assigneeId": team.lead_id, "points": 1}
    )
    assert kept.status_code == 200, kept.json()
    e = team.task("新功能", team.hubot_id, 5)
    assert e == "S-201"
    post(team.lead, "/api/tasks/drafts/approve")
    assert post(team.lead, "/api/sprints/2/start").status_code == 409  # E 還沒被接受
    post(team.bot, f"/api/tasks/{e}/accept")
    started2 = post(team.lead, "/api/sprints/2/start")
    assert started2.status_code == 200, started2.json()
    assert started2.json() == {"carriedOver": 1, "deferred": 0}
    assert sprint_statuses(team) == {1: "closed", 2: "active"}
    project = client.get("/api/project", headers=team.lead).json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (2, None)

    carried = next(t for t in client.get("/api/tasks", headers=team.lead).json() if t["id"] == d)
    assert (carried["sprintId"], carried["assigneeId"], carried["storyPoints"], carried["state"]) == (
        2,
        team.lead_id,
        1,
        "TODO",
    )
    assert carried["carry"] is None
    assert team.state(e) == "TODO"

    # ---- 資料真的在資料表裡 ----
    db.expire_all()
    assert [(s.number, s.status) for s in db.scalars(select(SprintRow).order_by(SprintRow.number))] == [
        (1, "closed"),
        (2, "active"),
    ]
    assert {t.code: t.state for t in db.scalars(select(TaskRow))} == {
        a: "DONE",
        b: "DONE",
        c: "DONE",
        d: "TODO",
        e: "TODO",
    }
    assert db.scalar(select(NotificationRow).where(NotificationRow.text == "審查通過，任務已完成")) is not None


def test_start_sprint_defers_unfinished_task_marked_defer(db: Session) -> None:
    """上一輪未完成的任務選擇「延後」：留在 Sprint 1、進入延續事項（task_id 指向它）"""
    team = Team()
    s1 = team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    x = team.task("要延後的", team.hubot_id, 2)
    post(team.lead, "/api/tasks/drafts/approve")
    post(team.bot, f"/api/tasks/{x}/accept")
    post(team.lead, f"/api/sprints/{s1['id']}/start")
    post(team.lead, f"/api/sprints/{s1['id']}/end")
    team.sprint("Sprint 2", "2026-12-15", "2026-12-28")
    assert client.put(f"/api/tasks/{x}/carry", headers=team.lead, json={"carry": False}).status_code == 200
    y = team.task("新的", team.hubot_id, 2)
    post(team.lead, "/api/tasks/drafts/approve")
    post(team.bot, f"/api/tasks/{y}/accept")
    res = post(team.lead, "/api/sprints/2/start")
    assert res.json() == {"carriedOver": 0, "deferred": 1}
    deferred = next(t for t in client.get("/api/tasks", headers=team.lead).json() if t["id"] == x)
    assert (deferred["state"], deferred["sprintId"]) == ("DEFERRED", 1)
    item = db.scalar(select(BacklogRow))
    assert item.kind == "deferred"
    assert item.task_id == db.scalar(select(TaskRow.id).where(TaskRow.code == x))


def test_negotiate_returns_task_to_leader(db: Session) -> None:
    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    x = team.task("太大了", team.hubot_id, 8)
    post(team.lead, "/api/tasks/drafts/approve")
    assert post(team.bot, f"/api/tasks/{x}/negotiate", {"reason": "  ", "suggestId": None}).status_code == 422
    assert (
        post(team.lead, f"/api/tasks/{x}/negotiate", {"reason": "x", "suggestId": None}).status_code == 403
    )  # 不是負責人
    res = post(
        team.bot, f"/api/tasks/{x}/negotiate", {"reason": "點數太高，建議拆小", "suggestId": None, "target": "points"}
    )
    assert res.status_code == 200, res.json()
    task = res.json()
    assert task["state"] == "RETURNED"
    assert task["negotiation"]["reason"] == "點數太高，建議拆小"
    assert task["returnSnapshot"]["storyPoints"] == 8  # 退回當下的內容
    # Leader 收到退回通知；成員的邀請通知處理完了；已退回的任務不能再接受或協商
    leader_notes = client.get("/api/notifications", headers=team.lead).json()
    assert [(n["type"], n["taskId"]) for n in leader_notes if n["type"] == "returned"] == [("returned", x)]
    assert post(team.bot, f"/api/tasks/{x}/accept").status_code == 409
    assert post(team.bot, f"/api/tasks/{x}/negotiate", {"reason": "again", "suggestId": None}).status_code == 409
    # Leader 修改後（RETURNED 可編輯）任務保留協商內容
    patched = client.patch(f"/api/tasks/{x}", headers=team.lead, json={"storyPoints": 3})
    assert patched.status_code == 200
    assert db.scalar(select(TaskRow.negotiation).where(TaskRow.code == x))["reason"] == "點數太高，建議拆小"


def test_target_review_by_named_member(db: Session) -> None:
    team = Team()
    s1 = team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    # 只有指定的成員（Hubot）能審查；規則 all 要求每位指定的人都同意，這裡只指定一位
    x = team.task("需要 Hubot 審查", team.lead_id, 3, {"mode": "target", "targets": [team.hubot_id], "rule": "all"})
    post(team.lead, "/api/tasks/drafts/approve")
    post(team.lead, f"/api/tasks/{x}/accept")
    post(team.lead, f"/api/sprints/{s1['id']}/start")
    post(team.lead, f"/api/tasks/{x}/start")
    post(team.lead, f"/api/tasks/{x}/review", DELIVERY)
    res = post(team.bot, f"/api/tasks/{x}/review/approve", {})
    assert res.json() == {"completed": True, "approvals": 1, "required": 1}
    assert team.state(x) == "DONE"


def test_lifecycle_endpoints_need_membership(db: Session) -> None:
    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    x = team.task("任務", team.hubot_id)
    stranger = bearer(
        make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=1999, login="x", email="x@e.com")
    )
    h = {**stranger, "X-Project-Id": team.lead["X-Project-Id"]}
    for url in (f"/api/tasks/{x}/accept", f"/api/tasks/{x}/start", "/api/sprints/1/start", "/api/sprints/1/end"):
        assert post(h, url).status_code == 403, url
        assert post({}, url).status_code == 401, url
    assert db.scalar(select(TaskRow.state).where(TaskRow.code == x)) == "DRAFT"


def test_sprint_status_swap_is_written_in_a_safe_order(db: Session) -> None:
    """Sprint 1 結束與 Sprint 2 啟動在同一批寫入：資料庫每個專案只允許一個進行中的 Sprint（部分唯一索引），
    所以一定要先把 Sprint 1 改成結束。UPDATE 同批時依主鍵順序送出，這裡讓 Sprint 2 的主鍵排在前面，
    若程式把兩個寫在同一批就會違反唯一索引"""
    from uuid import UUID

    from app.repo import db_store

    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    db.execute(SprintRow.__table__.update().where(SprintRow.number == 1).values(status="active"))
    team.sprint("Sprint 2", "2026-12-15", "2026-12-28")
    project_id = UUID(team.lead["X-Project-Id"])
    db.execute(SprintRow.__table__.update().where(SprintRow.number == 1).values(id=UUID(int=2**100)))
    db.execute(SprintRow.__table__.update().where(SprintRow.number == 2).values(id=UUID(int=1)))

    store, snapshot = db_store.load(db, project_id)
    store.sprints[1].status = "closed"
    store.sprints[2].status = "active"
    db_store.save(db, store, snapshot)  # 單一批寫入會因為唯一索引失敗
    db.flush()
    assert {s.number: s.status for s in db.scalars(select(SprintRow))} == {1: "closed", 2: "active"}


def test_board_list_endpoints_work_for_database_projects(db: Session) -> None:
    """Active Board 一載入就會讀問題、提案與執行計畫；這三個端點回 501 時看板會一直停在載入畫面。
    寫入端點還沒做，所以資料列直接寫進資料表"""
    from app.models import ExecutionPlan as PlanRow
    from app.models import Issue as IssueRow
    from app.models import IssueResponse as IssueResponseRow
    from app.models import Proposal as ProposalRow
    from app.models import ProposalComment as ProposalCommentRow

    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    code = team.task("任務", team.hubot_id)
    for url in ("/api/issues", "/api/proposals", "/api/execution-plans"):
        assert client.get(url, headers=team.lead).json() == [], url
        assert client.get(url).status_code == 401, url

    task = db.scalar(select(TaskRow).where(TaskRow.code == code))
    sprint = db.scalar(select(SprintRow))
    issue = IssueRow(task_id=task.id, type="tech", description="卡住了", reporter_member_id=task.assignee_member_id)
    proposal = ProposalRow(sprint_id=sprint.id, task_id=task.id, title="新想法", kind="idea")
    db.add_all([issue, proposal, PlanRow(task_id=task.id, checklist=[], checkpoints=[], dep_checks=[])])
    db.flush()
    db.add_all(
        [
            IssueResponseRow(issue_id=issue.id, author_member_id=task.assignee_member_id, text="我來看"),
            ProposalCommentRow(proposal_id=proposal.id, author_member_id=task.assignee_member_id, text="同意"),
        ]
    )
    db.flush()

    issues = client.get("/api/issues", headers=team.lead).json()
    assert [(i["taskId"], i["type"], i["status"], i["sprintId"]) for i in issues] == [(code, "tech", "reported", 1)]
    assert [r["text"] for r in issues[0]["responses"]] == ["我來看"]
    proposals = client.get("/api/proposals", headers=team.lead).json()
    assert [(p["title"], p["taskId"], p["status"], p["sprintId"]) for p in proposals] == [("新想法", code, "open", 1)]
    assert [c["text"] for c in proposals[0]["comments"]] == ["同意"]
    plans = client.get("/api/execution-plans", headers=team.lead).json()
    assert [p["taskId"] for p in plans] == [code]
    assert client.get(f"/api/tasks/{code}/execution-plan", headers=team.lead).json()["taskId"] == code
    assert client.get("/api/tasks/S-999/execution-plan", headers=team.lead).status_code == 404

    # 同一個人的另一個專案看不到這些資料
    pid = client.post("/api/projects", headers=bearer(make_token()), json={"name": "另一個", "prefix": "ot"}).json()[
        "id"
    ]
    elsewhere = {**bearer(make_token()), "X-Project-Id": pid}
    for url in ("/api/issues", "/api/proposals", "/api/execution-plans"):
        assert client.get(url, headers=elsewhere).json() == [], url
