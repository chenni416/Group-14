"""Sprint 與延續事項（資料庫版）：建立、規則、專案隔離、會議紀錄分析、延續事項帶入。

流程對應「建立專案 → 邀請成員 → 建 Sprint 1 → 分析會議紀錄」的前半段。
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.llm import get_llm
from app.ai.schemas import LlmQuestion, LlmQuestions
from app.core.config import get_settings
from app.main import app
from app.models import BacklogItem as BacklogRow
from app.models import Sprint as SprintRow
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

LEADER_SUB = "5f0c6a8e-1d2b-4c3a-9e8f-000000000123"
HUBOT_SUB = "5f0c6a8e-1d2b-4c3a-9e8f-000000000456"


class FakeLlm:
    def __init__(self) -> None:
        self.calls = 0

    def generate_json(self, *, system: str, user: str, schema):
        self.calls += 1
        assert schema is LlmQuestions
        return LlmQuestions(
            questions=[
                LlmQuestion(question="登入要支援哪些方式？", options=["GitHub", "Email"]),
                LlmQuestion(question="資料保留多久？", options=["30 天", "90 天"]),
            ]
        )

    def generate_text(self, *, system: str, user: str) -> str:
        return "ok"


@pytest.fixture(autouse=True)
def setup(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeLlm]:
    use_fake_supabase(monkeypatch)
    llm = FakeLlm()
    app.dependency_overrides[get_llm] = lambda: llm
    yield llm
    app.dependency_overrides.pop(get_llm, None)
    get_settings.cache_clear()


def leader() -> dict[str, str]:
    return bearer(make_token())


def hubot() -> dict[str, str]:
    return bearer(make_token(sub=HUBOT_SUB, github_id=1002, login="Hubot", email="hubot@example.com"))


def project(headers: dict[str, str], name: str = "Taskline", prefix: str = "tl") -> dict[str, str]:
    """建立專案，回傳要附帶的標頭（含 X-Project-Id）"""
    res = client.post("/api/projects", headers=headers, json={"name": name, "prefix": prefix})
    assert res.status_code == 200, res.json()
    return {**headers, "X-Project-Id": res.json()["id"]}


def sprint_body(**over: object) -> dict:
    body = {
        "name": "Sprint 1",
        "startDate": "2026-12-01",
        "endDate": "2026-12-14",
        "goal": "完成登入與專案管理",
        "capacity": {},
        "minutes": "討論登入與專案管理。",
        "docs": [],
    }
    return {**body, **over}


def create_sprint(headers: dict[str, str], **over: object) -> dict:
    res = client.post("/api/sprints", headers=headers, json=sprint_body(**over))
    assert res.status_code == 200, res.json()
    return res.json()


def test_new_project_has_no_sprint_and_defaults_start_sprint_1(db: Session) -> None:
    h = project(leader())
    assert client.get("/api/sprints", headers=h).json() == []
    d = client.get("/api/sprints/defaults", headers=h).json()
    assert (d["id"], d["name"], d["carryCount"]) == (1, "Sprint 1", 0)
    # capacity 預設為專案成員（建立專案的人）
    assert len(d["capacity"]) == 1


def test_create_sprint_persists_and_is_planning(db: Session) -> None:
    h = project(leader())
    created = create_sprint(h, capacity={"x": 8, "y": -3}, goal="  目標  ")
    assert created["id"] == 1
    assert created["status"] == "planning"
    assert created["step"] == 2
    assert created["goal"] == "目標"
    assert (created["start"], created["end"]) == ("12/01", "12/14")
    assert created["capacity"] == {"x": 8, "y": 0}  # 不得為負
    assert created["questions"] is None
    # 真的寫進資料庫，而且重新讀取得到相同內容
    assert db.scalar(select(SprintRow.number)) == 1
    assert client.get("/api/sprints", headers=h).json() == [created]


def test_only_one_planning_sprint_per_project(db: Session) -> None:
    h = project(leader())
    create_sprint(h)
    res = client.post("/api/sprints", headers=h, json=sprint_body(name="Sprint 2"))
    assert res.status_code == 409
    assert res.json()["code"] == "CONFLICT"


def test_create_validates_name_and_dates(db: Session) -> None:
    h = project(leader())
    for bad in (
        {"name": "   "},
        {"startDate": "2026-12-14", "endDate": "2026-12-01"},
        {"startDate": "not-a-date"},
        {"endDate": ""},
    ):
        res = client.post("/api/sprints", headers=h, json=sprint_body(**bad))
        assert res.status_code == 422, bad
        assert res.json()["code"] == "VALIDATION_ERROR"
    assert client.get("/api/sprints", headers=h).json() == []


def test_sprints_are_isolated_between_projects(db: Session) -> None:
    a = project(leader(), "專案 A", "A")
    b = project(leader(), "專案 B", "B")
    create_sprint(a)
    # 同一個人，另一個專案看不到、也不會被「已有規劃中」擋下，編號各自從 1 開始
    assert client.get("/api/sprints", headers=b).json() == []
    assert create_sprint(b, name="B 的 Sprint")["id"] == 1
    assert client.patch("/api/sprints/1", headers=b, json={"goal": "只改 B"}).json()["goal"] == "只改 B"
    assert client.get("/api/sprints", headers=a).json()[0]["goal"] == "完成登入與專案管理"


def test_member_cannot_see_other_projects_and_cannot_create(db: Session) -> None:
    h = project(leader())
    create_sprint(h)
    # 不是成員：用別人專案的 id 會被擋
    res = client.get("/api/sprints", headers={**hubot(), "X-Project-Id": h["X-Project-Id"]})
    assert res.status_code == 403
    assert res.json()["code"] == "PROJECT_ACCESS_DENIED"


def test_endpoints_require_login(db: Session) -> None:
    for method, url in (("get", "/api/sprints"), ("get", "/api/sprints/defaults"), ("get", "/api/backlog")):
        assert getattr(client, method)(url).status_code == 401, url


def test_update_rules(db: Session) -> None:
    h = project(leader())
    create_sprint(h)
    res = client.patch("/api/sprints/1", headers=h, json={"name": "新名稱", "endDate": "2026-12-20", "goal": "新目標"})
    assert res.status_code == 200, res.json()
    assert (res.json()["name"], res.json()["end"], res.json()["goal"]) == ("新名稱", "12/20", "新目標")
    # 結束日不能早於開始日
    assert client.patch("/api/sprints/1", headers=h, json={"endDate": "2026-11-01"}).status_code == 422
    assert client.patch("/api/sprints/9", headers=h, json={"goal": "x"}).status_code == 404
    # 啟動後（非規劃中）不能再改名稱、日期與 Capacity，但目標與會議紀錄可以
    db.execute(SprintRow.__table__.update().values(status="active"))
    assert client.patch("/api/sprints/1", headers=h, json={"name": "改名"}).status_code == 409
    assert client.patch("/api/sprints/1", headers=h, json={"capacity": {"x": 1}}).status_code == 409
    assert client.patch("/api/sprints/1", headers=h, json={"minutes": "新紀錄"}).json()["minutes"] == "新紀錄"


def test_only_leader_can_write(db: Session) -> None:
    h = project(leader())
    create_sprint(h)
    token = make_token(sub=HUBOT_SUB, github_id=1002, login="Hubot", email="hubot@example.com")
    # 邀請 Hubot 加入成為 Member（Hubot 先登入過一次，邀請才找得到他）
    client.get("/api/me", headers=bearer(token))
    inv = client.post("/api/invitations", headers=h, json={"githubLogin": "@Hubot"}).json()
    assert client.post(f"/api/invitations/{inv['id']}/accept", headers=bearer(token)).status_code == 200
    m = {**bearer(token), "X-Project-Id": h["X-Project-Id"]}
    assert len(client.get("/api/sprints", headers=m).json()) == 1  # Member 可以讀
    assert client.post("/api/sprints", headers=m, json=sprint_body()).status_code == 403
    assert client.patch("/api/sprints/1", headers=m, json={"goal": "x"}).status_code == 403
    assert client.post("/api/sprints/1/analyze", headers=m, json={"minutes": "x"}).status_code == 403


def test_docs_are_stored_and_replaced(db: Session) -> None:
    h = project(leader())
    created = create_sprint(h, docs=[{"name": "meeting.md", "size": "38 KB"}])
    assert created["docs"] == [{"name": "meeting.md", "size": "38 KB"}]
    added = client.post(
        "/api/sprints/1/docs", headers=h, json={"files": [{"name": "spec.pdf", "size": 2_400_000}]}
    ).json()
    assert {(d["name"], d["size"]) for d in added["docs"]} == {("meeting.md", "38 KB"), ("spec.pdf", "2.4 MB")}
    # 用 patch 取代整份清單：保留相同的、移除沒列出的
    patched = client.patch(
        "/api/sprints/1",
        headers=h,
        json={"docs": [{"name": "spec.pdf", "size": "2.4 MB"}, {"name": "new.md", "size": "1 KB"}]},
    ).json()
    assert {(d["name"], d["size"]) for d in patched["docs"]} == {("spec.pdf", "2.4 MB"), ("new.md", "1 KB")}


def test_analyze_and_answer_questions(db: Session, setup: FakeLlm) -> None:
    h = project(leader())
    create_sprint(h)
    res = client.post("/api/sprints/1/analyze", headers=h, json={"minutes": "會議紀錄內容"})
    assert res.status_code == 200, res.json()
    assert res.json() == {"unanswered": 2}
    sprint = client.get("/api/sprints", headers=h).json()[0]
    assert sprint["minutes"] == "會議紀錄內容"
    assert [q["id"] for q in sprint["questions"]] == ["q-1", "q-2"]
    # 回答後，重新讀取還在
    answered = client.put("/api/sprints/1/questions/q-1", headers=h, json={"answer": " GitHub "}).json()
    assert answered["questions"][0]["answer"] == "GitHub"
    assert client.put("/api/sprints/1/questions/nope", headers=h, json={"answer": "x"}).status_code == 404
    # 重新分析：已回答過的相同問題保留答案
    again = client.post("/api/sprints/1/analyze", headers=h, json={"minutes": "改過的紀錄"}).json()
    assert again == {"unanswered": 1}
    assert client.get("/api/sprints", headers=h).json()[0]["questions"][0]["answer"] == "GitHub"
    assert setup.calls == 2


def test_analyze_rejects_empty_minutes(db: Session) -> None:
    h = project(leader())
    create_sprint(h)
    res = client.post("/api/sprints/1/analyze", headers=h, json={"minutes": "  "})
    assert res.status_code == 400
    assert res.json()["message"] == "請先填寫會議紀錄"


def add_backlog(
    db: Session, project_id: str, text: str, from_sprint: SprintRow | None, kind: str = "deferred"
) -> BacklogRow:
    row = BacklogRow(
        project_id=project_id, text=text, kind=kind, from_sprint_id=from_sprint.id if from_sprint else None
    )
    db.add(row)
    db.flush()
    return row


def test_backlog_carry_into_next_sprint(db: Session) -> None:
    """Sprint 1 結束後留下的延續事項：Leader 選「納入本輪」→ 寫進 Sprint 2 的會議紀錄，建立後標記為已帶入"""
    h = project(leader())
    s1 = create_sprint(h)
    row1 = db.scalar(select(SprintRow))
    pid = row1.project_id
    a = add_backlog(db, pid, "S-3 匯出報表", row1)
    b = add_backlog(db, pid, "S-4 通知設定", row1, kind="multi")
    c = add_backlog(db, pid, "S-5 深色模式", row1)
    db.execute(SprintRow.__table__.update().values(status="closed"))  # Sprint 1 已結束

    listed = client.get("/api/backlog", headers=h).json()
    assert [i["text"] for i in listed] == ["S-3 匯出報表", "S-4 通知設定", "S-5 深色模式"]
    assert listed[0]["fromSprint"] == s1["name"]
    assert listed[0]["usedInSprintId"] is None

    for item, decision in ((a, "include"), (b, "include"), (c, "keep")):
        res = client.put(f"/api/backlog/{item.id}/decision", headers=h, json={"decision": decision})
        assert res.status_code == 200, res.json()

    d = client.get("/api/sprints/defaults", headers=h).json()
    assert (d["id"], d["name"], d["carryCount"]) == (2, "Sprint 2", 2)
    assert d["startDate"] == "2026-12-15"  # 接在 Sprint 1 結束日後一天
    assert "- [延後] S-3 匯出報表（Sprint 1 延後）" in d["minutes"]
    assert "- [跨 Sprint] S-4 通知設定（自 Sprint 1 延續）" in d["minutes"]
    assert "S-5" not in d["minutes"]  # 「繼續保留」不帶入

    s2 = create_sprint(h, name="Sprint 2", startDate=d["startDate"], endDate=d["endDate"], minutes=d["minutes"])
    assert s2["id"] == 2
    used = {i["text"]: i["usedInSprintId"] for i in client.get("/api/backlog", headers=h).json()}
    assert used == {"S-3 匯出報表": 2, "S-4 通知設定": 2, "S-5 深色模式": None}

    # 已帶入 Sprint 2 的項目，在 Sprint 2 還是規劃中時可以改成不納入；Sprint 2 的延續區塊同步更新
    res = client.put(f"/api/backlog/{b.id}/decision", headers=h, json={"decision": "keep"})
    assert res.status_code == 200
    minutes = client.get("/api/sprints", headers=h).json()[1]["minutes"]
    assert "S-4" not in minutes
    assert "S-3" in minutes


def test_backlog_decision_errors_and_isolation(db: Session) -> None:
    a = project(leader(), "專案 A", "A")
    b = project(leader(), "專案 B", "B")
    create_sprint(a)
    row = db.scalar(select(SprintRow))
    item = add_backlog(db, row.project_id, "只屬於 A", row)
    assert client.put("/api/backlog/not-a-uuid/decision", headers=a, json={"decision": "keep"}).status_code == 404
    # 別的專案不能動這個項目，也看不到
    assert client.put(f"/api/backlog/{item.id}/decision", headers=b, json={"decision": "include"}).status_code == 404
    assert client.delete(f"/api/backlog/{item.id}", headers=b).status_code == 404
    assert client.get("/api/backlog", headers=b).json() == []
    # 自己的專案可以移除
    assert client.delete(f"/api/backlog/{item.id}", headers=a).status_code == 204
    assert client.get("/api/backlog", headers=a).json() == []
