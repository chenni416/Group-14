"""協商退回後的處理、延後或調整的回覆、審查策略，以及驗收紀錄（用記憶體假資料，不需要資料庫）。

資料庫版（紀錄真的寫進 acceptance_records、重新載入還在）見 tests/db/test_negotiation_acceptance.py。
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repo.memory import MemoryStore
from app.repo.seed import make_task
from app.schemas.task import Negotiation, ReturnSnapshot, Task

LEADER = {"X-Demo-User": "m1"}
M2 = {"X-Demo-User": "m2"}
M3 = {"X-Demo-User": "m3"}
PLANNING = 3
"""假資料裡規劃中的 Sprint（每位成員的容量：m2 為 10、m3 為 8）"""
ACTIVE = 2

client = TestClient(app)


def add(store: MemoryStore, id: str, assignee: str = "m3", points: int = 3, state: str = "RETURNED", **over) -> Task:
    sprint = over.pop("sprint_id", PLANNING)
    task = make_task(id, sprint, "登入功能", "BE", points, assignee, state, **over)
    store.tasks[id] = task
    return task


def returned(store: MemoryStore, id: str = "S-301", by: str = "m3", **over) -> Task:
    """m3 協商退回的任務（同時記下退回當下的內容）"""
    task = add(store, id, state="RETURNED", **over)
    task.negotiation = Negotiation(by_id=by, reason="時間太趕", suggest_id=None)
    task.return_snapshot = ReturnSnapshot(
        title=task.title,
        acceptance_criteria=list(task.acceptance_criteria),
        story_points=task.story_points,
        story_points_reason=task.story_points_reason,
        assignee_id=task.assignee_id,
        policy=task.policy.model_copy(deep=True),
    )
    return task


def post(url: str, headers: dict, body: dict | None = None):
    return client.post(url, headers=headers, json=body) if body is not None else client.post(url, headers=headers)


def invites(store: MemoryStore, to_id: str, task_id: str) -> list[str]:
    return [n.text for n in store.notifications if n.to_id == to_id and n.task_id == task_id and n.type == "invite"]


# ---------- resend ----------


def test_resend_to_same_member_needs_changes_first(store: MemoryStore) -> None:
    returned(store)
    res = post("/api/tasks/S-301/resend", LEADER)
    assert res.status_code == 422
    assert "請先調整內容" in res.json()["message"]
    assert store.tasks["S-301"].state == "RETURNED"

    assert client.patch("/api/tasks/S-301", headers=LEADER, json={"storyPoints": 5}).status_code == 200
    res = post("/api/tasks/S-301/resend", LEADER)
    assert res.status_code == 200, res.json()
    assert res.json()["changes"] == ["點數 3 → 5"]
    task = store.tasks["S-301"]
    assert (task.state, task.negotiation, task.return_snapshot) == ("PENDING_MEMBER", None, None)
    assert invites(store, "m3", "S-301")[0] == "已依你的協商調整後重新指派：點數 3 → 5，請確認是否接受"


def test_resend_to_another_member_does_not_need_other_changes(store: MemoryStore) -> None:
    returned(store)
    assert client.patch("/api/tasks/S-301", headers=LEADER, json={"assigneeId": "m2"}).status_code == 200
    res = post("/api/tasks/S-301/resend", LEADER)
    assert res.status_code == 200, res.json()
    assert res.json()["changes"] == ["負責人 王思妤 → 林柏翰"]
    assert invites(store, "m2", "S-301")[0].startswith("預估 3 點（重新指派）")


def test_resend_is_blocked_when_member_is_over_capacity(store: MemoryStore) -> None:
    returned(store)
    add(store, "S-302", assignee="m3", points=8, state="PENDING_MEMBER")  # m3 的容量是 8
    assert client.patch("/api/tasks/S-301", headers=LEADER, json={"storyPoints": 2}).status_code == 200
    res = post("/api/tasks/S-301/resend", LEADER)
    assert res.status_code == 409
    assert res.json()["code"] == "OVER_CAPACITY"
    assert store.tasks["S-301"].state == "RETURNED"


def test_resend_checks_state_and_role(store: MemoryStore) -> None:
    add(store, "S-303", state="PENDING_MEMBER")
    assert post("/api/tasks/S-303/resend", LEADER).status_code == 409
    returned(store)
    assert post("/api/tasks/S-301/resend", M3).status_code == 403
    assert post("/api/tasks/S-404/resend", LEADER).status_code == 404


def test_resend_requires_complete_task(store: MemoryStore) -> None:
    task = returned(store)
    task.acceptance_criteria = []
    res = post("/api/tasks/S-301/resend", LEADER)
    assert res.status_code == 422
    assert "沒有驗收條件" in res.json()["message"]


# ---------- reset-return ----------


def test_reset_return_restores_the_content_at_return_time(store: MemoryStore) -> None:
    returned(store)
    edit = {
        "title": "改過的標題",
        "storyPoints": 8,
        "assigneeId": "m2",
        "policy": {"mode": "leader", "targets": [], "rule": "any"},
    }
    assert client.patch("/api/tasks/S-301", headers=LEADER, json=edit).status_code == 200
    res = post("/api/tasks/S-301/reset-return", LEADER)
    assert res.status_code == 200, res.json()
    task = store.tasks["S-301"]
    assert (task.title, task.story_points, task.assignee_id, task.policy.mode) == ("登入功能", 3, "m3", "pool")
    assert task.state == "RETURNED"  # 復原只還原內容，仍待 Leader 重新發送


def test_reset_return_without_snapshot_or_as_member(store: MemoryStore) -> None:
    add(store, "S-303", state="TODO")
    assert post("/api/tasks/S-303/reset-return", LEADER).status_code == 409
    returned(store)
    assert post("/api/tasks/S-301/reset-return", M3).status_code == 403


# ---------- revise ----------

REVISE = {
    "title": "登入功能（拆小）",
    "storyPoints": 2,
    "acceptanceCriteria": ["可以登入", "失敗有訊息"],
    "assigneeId": "m2",
    "policy": {"mode": "leader", "targets": [], "rule": "any"},
}


def test_revise_updates_the_task_and_sends_a_new_invite(store: MemoryStore) -> None:
    returned(store)
    res = client.put("/api/tasks/S-301/revise", headers=LEADER, json=REVISE)
    assert res.status_code == 200, res.json()
    task = store.tasks["S-301"]
    assert (task.state, task.title, task.story_points, task.assignee_id) == (
        "PENDING_MEMBER",
        "登入功能（拆小）",
        2,
        "m2",
    )
    assert (task.acceptance_criteria, task.policy.mode, task.edited) == (["可以登入", "失敗有訊息"], "leader", True)
    assert (task.negotiation, task.return_snapshot) == (None, None)
    assert invites(store, "m2", "S-301") == ["預估 2 點（Leader 已依協商調整），請確認是否接受"]


@pytest.mark.parametrize(
    ("patch", "message"),
    [
        ({"title": "  "}, "請輸入任務標題"),
        ({"acceptanceCriteria": [" "]}, "至少需要一條驗收條件"),
        ({"storyPoints": 4}, "點數只能是"),
        ({"policy": {"mode": "target", "targets": [], "rule": "any"}}, "請選擇指定的審查成員"),
    ],
)
def test_revise_validates_input(store: MemoryStore, patch: dict, message: str) -> None:
    returned(store)
    res = client.put("/api/tasks/S-301/revise", headers=LEADER, json={**REVISE, **patch})
    assert res.status_code == 422
    assert message in res.json()["message"]
    assert store.tasks["S-301"].state == "RETURNED"


def test_revise_rejects_unknown_member_wrong_state_and_member(store: MemoryStore) -> None:
    returned(store)
    assert (
        client.put("/api/tasks/S-301/revise", headers=LEADER, json={**REVISE, "assigneeId": "nobody"}).status_code
        == 404
    )
    assert client.put("/api/tasks/S-301/revise", headers=M3, json=REVISE).status_code == 403
    add(store, "S-303", state="PENDING_MEMBER")
    assert client.put("/api/tasks/S-303/revise", headers=LEADER, json=REVISE).status_code == 409


# ---------- resend-carry ----------


def carried(store: MemoryStore, id: str = "S-310") -> Task:
    """上一輪未完成、Leader 決定帶入、m3 協商退回的任務"""
    task = add(store, id, state="IN_PROGRESS", sprint_id=ACTIVE, points=5)
    task.carry = True
    task.carry_status = "returned"
    task.negotiation = Negotiation(by_id="m3", reason="本輪沒空", suggest_id=None)
    return task


def test_resend_carry_sends_the_changed_decision_again(store: MemoryStore) -> None:
    carried(store)
    res = post("/api/tasks/S-310/carry/resend", LEADER, {"carry": False})
    assert res.status_code == 200, res.json()
    task = store.tasks["S-310"]
    assert (task.carry, task.carry_status, task.negotiation) == (False, "pending", None)
    assert invites(store, "m3", "S-310") == [
        "上輪未完成，Leader 決定延後到之後的 Sprint，請確認（Leader 已依協商調整）"
    ]


def test_resend_carry_to_another_member_with_new_points(store: MemoryStore) -> None:
    carried(store)
    res = post("/api/tasks/S-310/carry/resend", LEADER, {"carry": True, "assigneeId": "m2", "points": 3})
    assert res.status_code == 200, res.json()
    task = store.tasks["S-310"]
    assert (task.carry_assignee_id, task.carry_points, task.carry_status) == ("m2", 3, "pending")
    assert "需要 3 點" in invites(store, "m2", "S-310")[0]


def test_resend_carry_rejects_unchanged_decision_and_wrong_state(store: MemoryStore) -> None:
    carried(store)
    same = post("/api/tasks/S-310/carry/resend", LEADER, {"carry": True})
    assert same.status_code == 422
    assert "請先改為延後" in same.json()["message"]
    assert post("/api/tasks/S-310/carry/resend", LEADER, {"carry": None}).status_code == 422
    assert post("/api/tasks/S-310/carry/resend", M3, {"carry": False}).status_code == 403
    store.tasks["S-310"].carry_status = "pending"
    assert post("/api/tasks/S-310/carry/resend", LEADER, {"carry": False}).status_code == 409


# ---------- plan-confirm ----------


def test_confirm_plan_records_the_reply_and_notifies_leaders(store: MemoryStore) -> None:
    add(store, "S-320", state="PENDING_MEMBER")
    store.notify("m3", "plan", "S-320", "m1", "S-320 將延後，請同意或提出異議")
    assert post("/api/tasks/S-320/plan-confirm", M3, {"status": "object", "note": " "}).status_code == 422
    res = post("/api/tasks/S-320/plan-confirm", M3, {"status": "object", "note": "太趕"})
    assert res.status_code == 200, res.json()
    confirms = store.tasks["S-320"].plan_confirms
    assert [(c.member_id, c.status, c.note) for c in confirms] == [("m3", "object", "太趕")]
    assert not [n for n in store.notifications if n.type == "plan" and n.status == "pending"]
    assert store.notifications[0].to_id == "m1"
    assert store.notifications[0].text == "對延後或調整提出異議：太趕"
    assert post("/api/tasks/S-320/plan-confirm", M3, {"status": "agree", "note": ""}).status_code == 200
    assert len(store.tasks["S-320"].plan_confirms) == 2


def test_only_the_assignee_can_confirm_plan(store: MemoryStore) -> None:
    add(store, "S-320", state="PENDING_MEMBER")
    assert post("/api/tasks/S-320/plan-confirm", LEADER, {"status": "agree", "note": ""}).status_code == 403
    assert post("/api/tasks/S-320/plan-confirm", M2, {"status": "agree", "note": ""}).status_code == 403


# ---------- policy ----------

TARGET = {"mode": "target", "targets": ["m2"], "rule": "all"}


def test_leader_and_assignee_can_update_policy(store: MemoryStore) -> None:
    add(store, "S-330", state="ASSIGNED").policy_reason = "AI 建議"
    res = client.put("/api/tasks/S-330/policy", headers=M3, json=TARGET)
    assert res.status_code == 200, res.json()
    task = store.tasks["S-330"]
    assert (task.policy.mode, task.policy.targets, task.policy.rule, task.policy_reason) == (
        "target",
        ["m2"],
        "all",
        "",
    )
    leader = client.put(
        "/api/tasks/S-330/policy", headers=LEADER, json={"mode": "pool", "targets": ["m2"], "rule": "any"}
    )
    assert leader.status_code == 200
    assert store.tasks["S-330"].policy.targets == []  # 只有指定成員模式保留審查者


def test_policy_is_limited_by_role_state_and_membership(store: MemoryStore) -> None:
    add(store, "S-330", state="ASSIGNED")
    assert client.put("/api/tasks/S-330/policy", headers=M2, json=TARGET).status_code == 403
    nobody = {"mode": "target", "targets": ["nobody"], "rule": "any"}
    assert client.put("/api/tasks/S-330/policy", headers=LEADER, json=nobody).status_code == 404
    for state in ("IN_REVIEW", "DONE"):
        store.tasks["S-330"].state = state
        assert client.put("/api/tasks/S-330/policy", headers=LEADER, json=TARGET).status_code == 409


# ---------- 驗收紀錄 ----------


def in_review(store: MemoryStore, id: str = "S-340") -> Task:
    task = add(store, id, state="IN_REVIEW", sprint_id=ACTIVE, points=3)
    task.acceptance_criteria = ["可以登入", "失敗有訊息"]
    task.policy = task.policy.model_copy(update={"mode": "leader"})
    task.reviewer_id = "m1"
    return task


ITEMS = [
    {"reviewer": None, "note": "", "ai": "met", "evidence": "PR 有登入頁"},
    {"reviewer": "unclear", "note": "沒看到錯誤訊息", "ai": "met", "evidence": "有 try/catch"},
]


def test_approve_and_request_changes_are_recorded_newest_first(store: MemoryStore) -> None:
    in_review(store)
    changes = post("/api/tasks/S-340/review/request-changes", LEADER, {"note": "缺錯誤訊息", "items": ITEMS})
    assert changes.status_code == 200, changes.json()
    store.tasks["S-340"].state = "IN_REVIEW"  # 成員修改後再次送審
    store.tasks["S-340"].reviewer_id = "m1"
    approved = post("/api/tasks/S-340/review/approve", LEADER, {"items": [ITEMS[0], {**ITEMS[1], "reviewer": "met"}]})
    assert approved.status_code == 200, approved.json()

    records = client.get("/api/tasks/S-340/acceptance/records", headers=M3).json()
    assert [r["decision"] for r in records] == ["approved", "changes"]
    assert records[1]["reason"] == "缺錯誤訊息"
    assert records[0]["reviewerId"] == "m1"
    assert records[1]["items"] == [
        {"ac": "可以登入", "ai": "met", "evidence": "PR 有登入頁", "reviewer": None, "note": ""},
        {"ac": "失敗有訊息", "ai": "met", "evidence": "有 try/catch", "reviewer": "unclear", "note": "沒看到錯誤訊息"},
    ]


def test_record_without_items_keeps_the_criteria_with_unclear_ai(store: MemoryStore) -> None:
    in_review(store)
    assert post("/api/tasks/S-340/review/approve", LEADER, {}).status_code == 200
    (record,) = client.get("/api/tasks/S-340/acceptance/records", headers=LEADER).json()
    assert [(i["ac"], i["ai"], i["reviewer"]) for i in record["items"]] == [
        ("可以登入", "unclear", None),
        ("失敗有訊息", "unclear", None),
    ]


def test_items_must_match_the_acceptance_criteria(store: MemoryStore) -> None:
    in_review(store)
    res = post("/api/tasks/S-340/review/approve", LEADER, {"items": [ITEMS[0]]})
    assert res.status_code == 422
    assert store.tasks["S-340"].state == "IN_REVIEW"
    assert not store.records


def test_records_of_unknown_task_and_other_tasks(store: MemoryStore) -> None:
    in_review(store)
    post("/api/tasks/S-340/review/approve", LEADER, {})
    assert client.get("/api/tasks/S-404/acceptance/records", headers=LEADER).status_code == 404
    in_review(store, "S-341")
    assert client.get("/api/tasks/S-341/acceptance/records", headers=LEADER).json() == []
