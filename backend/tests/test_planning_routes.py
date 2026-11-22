"""規劃流程的資料路由（記憶體假資料）：外殼資料、Sprint 設定、延續事項、任務審核調整、核准與送出。
規則移植自前端 mock（services/mock、lib/planning.ts），這裡驗證後端行為與它一致。"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.sprint import ClarifyQuestion

LEADER = {"X-Demo-User": "m1"}
MEMBER = {"X-Demo-User": "m4"}


@pytest.fixture
def client():
    yield TestClient(app, headers=LEADER)


def _task_body(**over) -> dict:
    base = {
        "title": "手動補一張 Task",
        "domain": "BE",
        "storyPoints": 2,
        "storyPointsReason": "小修改",
        "assigneeId": "m2",
        "acceptanceCriteria": ["API 回傳 200"],
        "policy": {"mode": "pool", "targets": [], "rule": "any"},
        "source": "",
    }
    return {**base, **over}


# ---------- 外殼讀取的資料 ----------


def test_shell_reads(client) -> None:
    me = client.get("/api/me").json()
    assert (me["id"], me["role"]) == ("m1", "Leader")
    assert client.get("/api/me", headers=MEMBER).json()["id"] == "m4"
    assert client.get("/api/organization").json()["slug"] == "atlab"
    project = client.get("/api/project").json()
    assert (project["activeSprintId"], project["planningSprintId"]) == (2, 3)
    assert [m["id"] for m in client.get("/api/members").json()] == ["m1", "m2", "m3", "m4", "m5"]
    assert [s["id"] for s in client.get("/api/sprints").json()] == [2, 3]
    assert len(client.get("/api/tasks").json()) == 10
    assert len(client.get("/api/docs").json()) == 6
    assert len(client.get("/api/backlog").json()) == 2


def test_notifications_are_per_member(client) -> None:
    mine = client.get("/api/notifications").json()
    others = client.get("/api/notifications", headers=MEMBER).json()
    assert {n["toId"] for n in mine} == {"m1"} and {n["toId"] for n in others} == {"m4"}
    assert len(mine) == 2 and len(others) == 3


def test_project_and_members_are_leader_only(client) -> None:
    patch = client.patch("/api/project", json={"prefix": "t l-1!", "name": "新名稱"}).json()
    assert patch["prefix"] == "TL1" and patch["name"] == "新名稱"
    assert client.get("/api/project").json()["name"] == "新名稱"
    assert client.patch("/api/project", json={"name": "x"}, headers=MEMBER).status_code == 403

    invited = client.post(
        "/api/members",
        json={
            "name": "新同學",
            "email": "",
            "role": "Member",
            "title": "BE",
            "domain": "BE",
            "tags": [],
            "capacity": 0,
        },
    ).json()
    assert invited["email"] == "—" and invited["capacity"] == 1  # 點數至少 1
    # 改成 Leader 時，原本的 Leader 降為 Member
    client.patch(f"/api/members/{invited['id']}", json={"role": "Leader"})
    roles = {m["id"]: m["role"] for m in client.get("/api/members").json()}
    assert roles[invited["id"]] == "Leader" and roles["m1"] == "Member"


def test_docs_upload_link_remove_and_search(client) -> None:
    up = client.post("/api/docs", json={"files": [{"name": "PRD_v3.md", "size": 5000}]}).json()
    assert up[0]["kind"] == "PRD" and up[0]["size"] == "5 KB" and up[0]["progress"] == 100
    link = client.post("/api/docs/links", json={"url": "https://figma.com/file/abc"}).json()
    assert link["kind"] == "Figma" and link["isLink"] is True
    assert len(client.get("/api/docs").json()) == 8
    assert client.delete(f"/api/docs/{up[0]['id']}").status_code == 204
    assert len(client.get("/api/docs").json()) == 7
    assert client.get("/api/docs/search", params={"q": "webhook 驗證"}).json()[0]["source"] == "openapi.yaml"


# ---------- Sprint 設定與延續事項 ----------


def test_sprint_defaults_and_conflict_on_second_planning_sprint(client) -> None:
    d = client.get("/api/sprints/defaults").json()
    assert (d["id"], d["name"], d["startDate"], d["endDate"]) == (4, "Sprint 4", "2026-11-22", "2026-12-05")
    body = {
        "name": "Sprint 4",
        "startDate": d["startDate"],
        "endDate": d["endDate"],
        "goal": "",
        "capacity": {},
        "minutes": "",
        "docs": [],
    }
    assert client.post("/api/sprints", json=body).status_code == 409  # 已經有規劃中的 Sprint 3


def test_sprint_update_and_add_docs(client) -> None:
    res = client.patch(
        "/api/sprints/3",
        json={"name": " 新名稱 ", "startDate": "2026-11-11", "capacity": {"m1": 7, "m2": -3}, "goal": " 新目標 "},
    ).json()
    assert (res["name"], res["start"], res["goal"]) == ("新名稱", "11/11", "新目標")
    assert res["capacity"] == {"m1": 7, "m2": 0}
    assert client.patch("/api/sprints/3", json={"endDate": "2026-11-01"}).status_code == 400  # 結束早於開始
    assert client.patch("/api/sprints/2", json={"name": "改名"}).status_code == 400  # 進行中不能改名稱
    docs = client.post("/api/sprints/3/docs", json={"files": [{"name": "會議.pdf", "size": 2500000}]}).json()["docs"]
    assert docs == [{"name": "會議.pdf", "size": "2.5 MB"}]


def test_backlog_decision_syncs_minutes_block(client) -> None:
    item = client.put("/api/backlog/b1/decision", json={"decision": "include"}).json()
    assert item["decision"] == "include" and item["usedInSprintId"] == 3
    minutes = client.get("/api/sprints").json()[1]["minutes"]
    assert "## 延續事項（系統自動帶入）" in minutes and "- [延後] Email 推播提醒" in minutes
    # 改回保留：區塊消失，原本的會議紀錄不受影響
    client.put("/api/backlog/b1/decision", json={"decision": "keep"})
    assert "延續事項" not in client.get("/api/sprints").json()[1]["minutes"]
    assert client.put("/api/backlog/nope/decision", json={"decision": "keep"}).status_code == 404
    assert client.delete("/api/backlog/b2").status_code == 204
    assert [b["id"] for b in client.get("/api/backlog").json()] == ["b1"]


def test_sprint_setup_is_leader_only(client) -> None:
    assert client.patch("/api/sprints/3", json={"goal": "x"}, headers=MEMBER).status_code == 403
    assert client.put("/api/backlog/b1/decision", json={"decision": "keep"}, headers=MEMBER).status_code == 403


# ---------- 任務：新增、修改、延後、恢復 ----------


def test_create_update_remove_task(client) -> None:
    created = client.post("/api/tasks", json=_task_body()).json()
    assert created["id"] == "S-301" and created["state"] == "DRAFT" and created["origin"] == "human"
    assert created["branch"] == "feat/S301-task" and created["tags"] == ["FastAPI", "PostgreSQL"]
    assert (
        client.post("/api/tasks", json=_task_body(acceptanceCriteria=[])).json()["acceptanceCriteria"][0]
        == "成果與會議決議一致"
    )
    assert client.post("/api/tasks", json=_task_body()).json()["id"] == "S-303"
    assert client.post("/api/tasks", json=_task_body(title="  ")).status_code == 400
    assert client.post("/api/tasks", json=_task_body(assigneeId="m99")).status_code == 404

    updated = client.patch("/api/tasks/S-301", json={"storyPoints": 5, "assigneeId": "m3"}).json()
    assert (updated["storyPoints"], updated["assigneeId"], updated["edited"]) == (5, "m3", True)
    assert client.patch("/api/tasks/S-212", json={"storyPoints": 1}).status_code == 400  # 審查中不能編輯

    assert client.delete("/api/tasks/S-301").status_code == 204
    assert "S-301" not in [t["id"] for t in client.get("/api/tasks").json()]


def test_defer_and_restore_task(client) -> None:
    task = client.post("/api/tasks", json=_task_body(assigneeId="m2")).json()
    deferred = client.post(f"/api/tasks/{task['id']}/defer").json()
    assert deferred["state"] == "DEFERRED" and deferred["prevState"] == "DRAFT"
    backlog = [b for b in client.get("/api/backlog").json() if b["taskId"] == task["id"]]
    assert len(backlog) == 1 and backlog[0]["fromSprint"] == "Sprint 3"
    # 負責人收到「同意或異議」的通知
    plan = [n for n in client.get("/api/notifications", headers={"X-Demo-User": "m2"}).json() if n["type"] == "plan"]
    assert len(plan) == 1
    restored = client.post(f"/api/tasks/{task['id']}/restore").json()
    assert restored["state"] == "DRAFT" and restored["prevState"] is None
    assert [b for b in client.get("/api/backlog").json() if b["taskId"] == task["id"]] == []
    assert client.post("/api/tasks/S-212/defer").status_code == 400  # 審查中不能延後


def test_task_edits_are_leader_only(client) -> None:
    assert client.post("/api/tasks", json=_task_body(), headers=MEMBER).status_code == 403
    assert client.patch("/api/tasks/S-243", json={"storyPoints": 1}, headers=MEMBER).status_code == 403
    assert client.post("/api/tasks/drafts/approve", headers=MEMBER).status_code == 403


# ---------- 上輪未完成任務：帶入或延後 ----------


def test_set_carry_rules(client) -> None:
    res = client.put("/api/tasks/S-243/carry", json={"carry": True, "assigneeId": "m2", "points": 3}).json()
    assert (res["carry"], res["carryAssigneeId"], res["carryPoints"]) == (True, "m2", 3)
    # 改派給原負責人、點數同原本 → 視為沒有調整
    same = client.put("/api/tasks/S-243/carry", json={"carry": True, "assigneeId": "m4", "points": 2}).json()
    assert same["carryAssigneeId"] is None and same["carryPoints"] is None
    later = client.put("/api/tasks/S-243/carry", json={"carry": False}).json()
    assert later["carry"] is False and later["carryAssigneeId"] is None
    assert client.put("/api/tasks/S-243/carry", json={"carry": True, "points": 41}).status_code == 400
    assert client.put("/api/tasks/S-211/carry", json={"carry": True}).status_code == 400  # 已完成，不能帶入


# ---------- 核准前檢查與核准 ----------


def test_approve_blocked_by_missing_assignee(client) -> None:
    client.post("/api/tasks", json=_task_body(assigneeId=""))
    res = client.post("/api/tasks/drafts/approve")
    assert res.status_code == 422 and res.json()["code"] == "PREFLIGHT_FAILED"
    assert "沒有負責人" in res.json()["message"]


def test_approve_blocked_by_unanswered_questions(client, store) -> None:
    client.post("/api/tasks", json=_task_body())
    store.sprints[3].questions = [
        ClarifyQuestion(id="q-1", question="保留多久？", options=["一個月", "永久"], answer="")
    ]
    assert client.post("/api/tasks/drafts/approve").status_code == 422
    client.put("/api/sprints/3/questions/q-1", json={"answer": "永久"})
    assert client.post("/api/tasks/drafts/approve").status_code == 200


def test_approve_over_capacity_is_blocked_then_passes_after_fix(client) -> None:
    client.post("/api/tasks", json=_task_body(storyPoints=8, assigneeId="m1"))
    extra = client.post("/api/tasks", json=_task_body(storyPoints=2, assigneeId="m1")).json()
    blocked = client.post("/api/tasks/drafts/approve")
    assert blocked.status_code == 422 and "陳怡君 超過點數上限（10/8）" in blocked.json()["message"]
    client.patch(f"/api/tasks/{extra['id']}", json={"assigneeId": "m2"})
    res = client.post("/api/tasks/drafts/approve")
    assert res.status_code == 200 and res.json() == {"count": 2}
    tasks = {t["id"]: t for t in client.get("/api/tasks").json()}
    assert tasks[extra["id"]]["state"] == "PENDING_MEMBER"
    invite = [
        n for n in client.get("/api/notifications", headers={"X-Demo-User": "m2"}).json() if n["type"] == "invite"
    ]
    assert invite and invite[0]["taskId"] == extra["id"]
    assert client.get("/api/sprints").json()[1]["step"] == 5


# ---------- 送出規劃 ----------


def _draft(**over) -> dict:
    story = {
        "id": "st-1",
        "no": 1,
        "code": "S3-1",
        "title": "AI 對話",
        "userStory": "身為成員，我想要提問，以便釐清規格。",
        "storyPoints": 5,
        "scope": ["對話 API"],
        "rationale": "同一情境",
        "sources": [{"line": 2, "text": "對話"}],
        "dependsOn": [],
    }

    def task(no, **kw):
        base = {
            "id": f"st-1-tk-{no}",
            "storyId": "st-1",
            "no": no,
            "code": f"S-31{no}",
            "title": f"Task {no}",
            "domain": "BE",
            "branchPrefix": "feat",
            "branchSlug": "chat-api",
            "storyPoints": 2,
            "acceptanceCriteria": ["API 回傳 200"],
            "assigneeId": "m2",
            "suggestedAssigneeId": "m2",
            "reviewer": {"mode": "pool", "memberId": None},
            "analysis": "可先以模擬資料開發",
            "assignReason": "領域相同",
            "dependsOn": [],
        }
        return {**base, **kw}

    base = {
        "sprintId": 3,
        "stories": [story],
        "tasks": [task(1), task(2, dependsOn=[{"id": "st-1-tk-1", "reason": "需要 API"}])],
    }
    return {**base, **over}


def _decide_all_carry(client) -> None:
    for t in client.get("/api/tasks").json():
        if t["sprintId"] == 2 and t["state"] in ("TODO", "IN_PROGRESS", "IN_REVIEW"):
            client.put(f"/api/tasks/{t['id']}/carry", json={"carry": False})


def test_submit_plan_requires_carry_decisions_then_creates_tasks(client) -> None:
    res = client.post("/api/planning/drafts/submit", json=_draft())
    assert res.status_code == 400 and "尚未決定帶入或延後" in res.json()["message"]

    _decide_all_carry(client)
    res = client.post("/api/planning/drafts/submit", json=_draft())
    assert res.status_code == 200 and res.json() == {"count": 2}

    tasks = {t["id"]: t for t in client.get("/api/tasks").json()}
    t2 = tasks["S-312"]
    assert t2["state"] == "PENDING_MEMBER" and t2["assigneeId"] == "m2" and t2["sprintId"] == 3
    assert t2["dependsOn"] == [{"id": "S-311", "reason": "需要 API"}]  # 草稿 id 轉成正式任務編號
    assert t2["epic"] == "S3-1 AI 對話" and t2["branch"] == "feat/S312-chat-api" and t2["origin"] == "ai"
    # 帶入／延後的決定一起送出，等成員確認
    assert tasks["S-243"]["carryStatus"] == "pending"
    inbox = client.get("/api/notifications", headers={"X-Demo-User": "m2"}).json()
    assert {n["taskId"] for n in inbox if n["type"] == "invite"} >= {"S-311", "S-312"}
    # 同一個 Sprint 不能重複送出
    assert client.post("/api/planning/drafts/submit", json=_draft()).status_code == 409


def test_submit_plan_validation(client) -> None:
    _decide_all_carry(client)
    unassigned = _draft()
    unassigned["tasks"][0]["assigneeId"] = None
    assert "尚未指派" in client.post("/api/planning/drafts/submit", json=unassigned).json()["message"]

    blocking = _draft()
    blocking["tasks"][0]["deferred"] = True  # Task 2 依賴被延後的 Task 1
    res = client.post("/api/planning/drafts/submit", json=blocking)
    assert res.status_code == 400 and "S-312 需等待的 S-311 已延後" in res.json()["message"]

    bad_member = _draft()
    bad_member["tasks"][0]["assigneeId"] = "m99"
    assert client.post("/api/planning/drafts/submit", json=bad_member).status_code == 404


def test_submit_plan_records_deferred_items_in_backlog(client) -> None:
    _decide_all_carry(client)
    draft = _draft()
    draft["tasks"][1]["dependsOn"] = []
    draft["tasks"][1]["deferred"] = True
    assert client.post("/api/planning/drafts/submit", json=draft).json() == {"count": 1}
    texts = [b["text"] for b in client.get("/api/backlog").json()]
    assert "S-312 Task 2" in texts  # 個別延後的 Task 寫進延續事項


# ---------- 從「建立 Sprint」開始（不預建 Sprint 3） ----------


def test_start_without_planning_sprint_then_create_sprint_3() -> None:
    from app.ai.llm import get_llm
    from app.repo import get_store
    from app.repo.seed import build_seed

    fresh = build_seed(planning_sprint=False)
    app.dependency_overrides[get_store] = lambda: fresh
    app.dependency_overrides[get_llm] = lambda: object()  # 不呼叫模型；也不依賴本機有沒有 OPENAI_API_KEY
    client = TestClient(app, headers=LEADER)

    assert client.get("/api/project").json()["planningSprintId"] is None
    assert [s["id"] for s in client.get("/api/sprints").json()] == [2]
    assert client.post("/api/planning/drafts/chat", json={"question": "x", "storyTitle": None}).status_code == 409

    d = client.get("/api/sprints/defaults").json()
    assert (d["id"], d["name"]) == (3, "Sprint 3")
    body = {k: d[k] for k in ("name", "startDate", "endDate", "capacity", "minutes")} | {"goal": "新目標", "docs": []}
    created = client.post("/api/sprints", json=body).json()
    assert (created["id"], created["status"], created["step"]) == (3, "planning", 2)
    assert client.get("/api/project").json()["planningSprintId"] == 3
    assert client.post("/api/sprints", json=body).status_code == 409  # 不能同時有兩個規劃中的 Sprint
    app.dependency_overrides.pop(get_llm, None)


def test_sample_minutes() -> None:
    res = TestClient(app, headers=LEADER).get("/api/planning/minutes/sample")
    assert res.status_code == 200 and res.json().startswith("# Sprint 3 規劃會議")
