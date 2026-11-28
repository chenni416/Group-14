"""驗收紀錄與協商退回改存資料庫：紀錄寫進 acceptance_records、重新載入還在、請求失敗時不寫。

規則本身（各種錯誤情況）由 tests/test_task_negotiation.py 用記憶體假資料驗證；這裡只驗證和資料表的接線。
"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.models import AcceptanceRecord as RecordRow
from app.models import Notification as NotificationRow
from app.models import Task as TaskRow
from tests.auth_helpers import use_fake_supabase
from tests.db.test_journey import DELIVERY, LEADER_POLICY, Team, post

client = TestClient(app)

ITEM = {"reviewer": "unclear", "note": "沒看到錯誤訊息", "ai": "met", "evidence": "有 try/catch"}


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def task_in_review(team: Team, policy: dict | None = None) -> str:
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    task = team.task("登入 API", team.hubot_id, 3, policy or LEADER_POLICY)
    post(team.lead, "/api/tasks/drafts/approve")
    post(team.bot, f"/api/tasks/{task}/accept")
    assert post(team.lead, "/api/sprints/1/start").status_code == 200
    post(team.bot, f"/api/tasks/{task}/start")
    assert post(team.bot, f"/api/tasks/{task}/review", DELIVERY).status_code == 200
    return task


def count(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model)) or 0


def test_acceptance_records_are_saved_and_reloaded(db: Session) -> None:
    team = Team()
    task = task_in_review(team)

    changes = post(team.lead, f"/api/tasks/{task}/review/request-changes", {"note": "缺錯誤處理", "items": [ITEM]})
    assert changes.status_code == 200, changes.json()
    post(team.bot, f"/api/tasks/{task}/review", DELIVERY)
    approved = post(
        team.lead, f"/api/tasks/{task}/review/approve", {"items": [{**ITEM, "reviewer": "met", "note": ""}]}
    )
    assert approved.status_code == 200, approved.json()

    # 新的請求：從資料表重新載入，新的在前，內容原樣保存
    records = client.get(f"/api/tasks/{task}/acceptance/records", headers=team.bot).json()
    assert [(r["decision"], r["reason"], r["reviewerId"]) for r in records] == [
        ("approved", "", team.lead_id),
        ("changes", "缺錯誤處理", team.lead_id),
    ]
    assert records[1]["items"] == [
        {"ac": "符合需求", "ai": "met", "evidence": "有 try/catch", "reviewer": "unclear", "note": "沒看到錯誤訊息"}
    ]
    assert records[0]["items"][0]["reviewer"] == "met"

    db.expire_all()
    rows = db.scalars(select(RecordRow).order_by(RecordRow.created_at)).all()
    assert [r.decision for r in rows] == ["changes", "approved"]
    assert rows[0].task_id == db.scalar(select(TaskRow.id).where(TaskRow.code == task))
    assert str(rows[0].reviewer_member_id) == team.lead_id


def test_failed_review_writes_no_record(db: Session) -> None:
    team = Team()
    task = task_in_review(team)
    bad = post(team.lead, f"/api/tasks/{task}/review/approve", {"items": []})  # 驗收條件有 1 條，items 卻是 0 條
    assert bad.status_code == 422
    assert post(team.bot, f"/api/tasks/{task}/review/approve", {}).status_code == 403  # 負責人不能審查自己
    assert count(db, RecordRow) == 0
    assert team.state(task) == "IN_REVIEW"


def test_records_are_isolated_between_projects(db: Session) -> None:
    team = Team()
    task = task_in_review(team)
    post(team.lead, f"/api/tasks/{task}/review/approve", {})
    other_id = client.post("/api/projects", headers=team.lead, json={"name": "Other", "prefix": "ot"}).json()["id"]
    other = {**team.lead, "X-Project-Id": other_id}  # 同一個 Leader 帳號的另一個專案
    # 另一個專案看不到這個任務，也就看不到它的紀錄
    assert client.get(f"/api/tasks/{task}/acceptance/records", headers=other).status_code == 404


def test_negotiation_round_trip_is_saved(db: Session) -> None:
    """成員協商退回 → Leader 調整後重新發送 → 成員收到邀請（每一步都跨請求，從資料表讀回）"""
    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    task = team.task("登入 API", team.hubot_id, 3)
    post(team.lead, "/api/tasks/drafts/approve")
    returned = post(team.bot, f"/api/tasks/{task}/negotiate", {"reason": "時間太趕", "suggestId": None})
    assert returned.json()["state"] == "RETURNED"

    assert post(team.lead, f"/api/tasks/{task}/resend").status_code == 422  # 同一位成員，沒有任何調整
    assert client.patch(f"/api/tasks/{task}", headers=team.lead, json={"storyPoints": 2}).status_code == 200
    reset = post(team.lead, f"/api/tasks/{task}/reset-return")
    assert (reset.json()["storyPoints"], reset.json()["state"]) == (3, "RETURNED")  # 復原到退回當下
    client.patch(f"/api/tasks/{task}", headers=team.lead, json={"storyPoints": 2})

    resent = post(team.lead, f"/api/tasks/{task}/resend")
    assert resent.status_code == 200, resent.json()
    assert resent.json()["changes"] == ["點數 3 → 2"]
    assert resent.json()["task"]["state"] == "PENDING_MEMBER"
    assert resent.json()["task"]["negotiation"] is None

    db.expire_all()
    row = db.scalar(select(TaskRow).where(TaskRow.code == task))
    assert (row.state, row.story_points, row.negotiation, row.return_snapshot) == ("PENDING_MEMBER", 2, None, None)
    invite = db.scalars(select(NotificationRow).where(NotificationRow.text.like("已依你的協商調整後重新指派%"))).one()
    assert str(invite.recipient_member_id) == team.hubot_id
    assert post(team.bot, f"/api/tasks/{task}/accept").json()["state"] == "ASSIGNED"


def test_plan_confirm_and_policy_are_saved(db: Session) -> None:
    team = Team()
    team.sprint("Sprint 1", "2026-12-01", "2026-12-14")
    task = team.task("登入 API", team.hubot_id, 3)
    post(team.lead, "/api/tasks/drafts/approve")

    replied = post(team.bot, f"/api/tasks/{task}/plan-confirm", {"status": "object", "note": "時間太趕"})
    assert replied.status_code == 200, replied.json()
    assert post(team.lead, f"/api/tasks/{task}/plan-confirm", {"status": "agree", "note": ""}).status_code == 403
    target = {"mode": "target", "targets": [team.lead_id], "rule": "all"}
    assert client.put(f"/api/tasks/{task}/policy", headers=team.bot, json=target).status_code == 200

    db.expire_all()
    row = db.scalar(select(TaskRow).where(TaskRow.code == task))
    assert [(c["status"], c["note"]) for c in row.plan_confirms] == [("object", "時間太趕")]
    assert row.policy == {"mode": "target", "targets": [team.lead_id], "rule": "all"}
    assert any(n.text == "對延後或調整提出異議：時間太趕" for n in db.scalars(select(NotificationRow)))
