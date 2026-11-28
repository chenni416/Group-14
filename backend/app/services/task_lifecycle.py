"""任務核准派工之後的流程：成員接受／協商退回 → 開始開發 → 送審 → 審查（認領、通過、要求修改），以及 Sprint 啟動與結束。

規則移植自前端 services/mock/tasks.ts（accept、negotiate、claimReview、startDevelopment、submitForReview、
approveReview、requestChanges、sprints.start、sprints.end）與 mocks/handlers/review.ts（sendToReview、canReview）。
操作的是 MemoryStore；GitHub 登入的成員由 `ProjectStore` 載入與寫回資料庫（見 repo/db_store.py）。

與前端 mock 不同的地方（mock 沒有檢查，這裡補上，避免 API 被亂序呼叫）：
- 每個動作都檢查任務目前的狀態（例如只有 PENDING_MEMBER 的任務可以接受、只有 IN_REVIEW 的可以審查）
- 通知 Leader 時通知專案所有的 Leader（mock 只有一位）

審查通過與要求修改時，把逐條驗收判斷寫成驗收紀錄（`MemoryStore.records`，對應 acceptance.records）。

還沒做：Sprint 結束時自動建立回顧（retros）。
"""

import uuid
from datetime import UTC, datetime
from typing import Literal

from app.core.errors import ApiError
from app.repo.memory import MemoryStore
from app.schemas.acceptance import (
    AcceptanceItem,
    AcceptanceRecord,
    Delivery,
    ReviewItemInput,
    SubmitDeliveryInput,
)
from app.schemas.member import Member
from app.schemas.sprint import EndSprintResult, Sprint, SprintSummary, StartSprintResult
from app.schemas.task import (
    ApproveReviewBody,
    NegotiateInput,
    Negotiation,
    RequestChangesBody,
    ReturnSnapshot,
    ReviewResult,
    Task,
)
from app.services.task_edit_flow import defer_task

BOARD_STATES = ("TODO", "IN_PROGRESS", "IN_REVIEW", "DONE")
"""上看板的狀態（Sprint 啟動後）"""


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def is_unfinished(task: Task) -> bool:
    return task.state in BOARD_STATES and task.state != "DONE"


def carry_owner(task: Task) -> str:
    return task.carry_assignee_id or task.assignee_id


def carry_points(task: Task) -> int:
    return task.carry_points if task.carry_points is not None else task.story_points


def carry_confirmer(task: Task) -> str:
    """需要確認帶入／延後決定的成員：帶入給新負責人確認，延後給目前負責人確認"""
    return task.assignee_id if task.carry is False else carry_owner(task)


def _leaders(store: MemoryStore) -> list[Member]:
    return [m for m in store.members if m.role == "Leader"]


def _notify_leaders(store: MemoryStore, type_: str, task: Task, from_id: str, text: str) -> None:
    for leader in _leaders(store):
        if leader.id != from_id:
            store.notify(leader.id, type_, task.id, from_id, text)  # type: ignore[arg-type]


def _assignee_only(task: Task, me: Member, action: str) -> None:
    if task.assignee_id != me.id:
        raise ApiError(f"只有負責人可以{action}", status=403, code="FORBIDDEN")


def _expect_state(task: Task, states: tuple[str, ...], action: str) -> None:
    if task.state not in states:
        raise ApiError(f"任務目前的狀態（{task.state}）不能{action}", status=409, code="INVALID_STATE")


# ---------- 成員：接受與協商退回 ----------


def accept(store: MemoryStore, me: Member, task_id: str) -> Task:
    task = store.find_task(task_id)
    if task.carry_status == "pending":  # 上一輪任務的帶入／延後決定
        if carry_confirmer(task) != me.id:
            raise ApiError("只有被指派的成員可以確認", status=403, code="FORBIDDEN")
        task.carry_status = "accepted"
        store.resolve_notifications(task.id, ["invite"])
        _notify_leaders(store, "info", task, me.id, "已接受帶入下個 Sprint" if task.carry else "已確認延後")
        return task
    _assignee_only(task, me, "接受")
    _expect_state(task, ("PENDING_MEMBER",), "接受")
    task.state = "ASSIGNED"
    store.resolve_notifications(task.id, ["invite"])
    _notify_leaders(store, "info", task, me.id, "已接受任務指派")
    return task


def _snapshot(task: Task) -> ReturnSnapshot:
    return ReturnSnapshot(
        title=task.title,
        acceptance_criteria=list(task.acceptance_criteria),
        story_points=task.story_points,
        story_points_reason=task.story_points_reason,
        assignee_id=task.assignee_id,
        policy=task.policy.model_copy(deep=True),
    )


def negotiate(store: MemoryStore, me: Member, task_id: str, body: NegotiateInput) -> Task:
    reason = body.reason.strip()
    if not reason:
        raise ApiError("請填寫原因", status=422, code="VALIDATION_ERROR")
    task = store.find_task(task_id)
    if task.carry_status == "pending":
        if carry_confirmer(task) != me.id:
            raise ApiError("只有被指派的成員可以協商", status=403, code="FORBIDDEN")
        task.carry_status = "returned"
        task.negotiation = Negotiation(by_id=me.id, reason=reason, suggest_id=body.suggest_id)
    else:
        _assignee_only(task, me, "協商")
        _expect_state(task, ("PENDING_MEMBER",), "協商退回")
        task.state = "RETURNED"
        task.negotiation = Negotiation(by_id=me.id, reason=reason, suggest_id=body.suggest_id, target=body.target)
        task.return_snapshot = _snapshot(task)
    store.resolve_notifications(task.id, ["invite"])
    _notify_leaders(store, "returned", task, me.id, reason)
    return task


# ---------- 開發與送審 ----------


def start_development(store: MemoryStore, me: Member, task_id: str) -> Task:
    task = store.find_task(task_id)
    _assignee_only(task, me, "開始開發")
    _expect_state(task, ("TODO",), "開始開發（Sprint 啟動後才會進入待辦）")
    task.state = "IN_PROGRESS"
    return task


def _send_to_review(store: MemoryStore, task: Task) -> None:
    """依 Review 策略決定誰要審查，並發出通知"""
    policy = task.policy
    if policy.mode == "target" and not policy.targets:
        raise ApiError("指定成員模式至少需選一位審查者", status=422, code="VALIDATION_ERROR")
    task.state = "IN_REVIEW"
    task.review_started_at = _now()
    task.approvals = []
    task.reviewer_id = None
    task.claimed_at = None
    pr_note = f"PR {task.delivery.pr_url}" if task.delivery else "PR"
    if policy.mode == "leader":
        leaders = [m for m in _leaders(store) if m.id != task.assignee_id]
        if not leaders:
            raise ApiError("找不到可以審查的 Leader（負責人不能審查自己的任務）", status=409, code="NO_REVIEWER")
        task.reviewer_id = leaders[0].id
        store.notify(leaders[0].id, "review", task.id, task.assignee_id, f"請你以 Leader 身分審查 {pr_note}")
    elif policy.mode == "pool":
        others = [m for m in store.members if m.id != task.assignee_id]
        if not others:
            raise ApiError("專案裡沒有其他成員可以審查", status=409, code="NO_REVIEWER")
        for m in others:
            store.notify(m.id, "pool", task.id, task.assignee_id, f"{pr_note} 已送審，任何有空的成員都可以領取審查")
    else:
        rule = "需全員同意" if policy.rule == "all" else "需 1 人同意"
        for target in policy.targets:
            store.notify(target, "review", task.id, task.assignee_id, f"請你審查 {pr_note}（{rule}）")


def submit_for_review(store: MemoryStore, me: Member, task_id: str, body: SubmitDeliveryInput | None) -> Task:
    task = store.find_task(task_id)
    _assignee_only(task, me, "送審")
    _expect_state(task, ("IN_PROGRESS",), "送審")
    if body is not None and not body.pr_url.strip():
        raise ApiError("請填寫 PR 連結", status=422, code="VALIDATION_ERROR")
    if body is not None:
        task.delivery = Delivery(
            pr_url=body.pr_url.strip(),
            deliverables=body.deliverables,
            test_note=body.test_note,
            unfinished=body.unfinished,
            questions=body.questions,
            submitted_at=_now(),
        )
    _send_to_review(store, task)
    return task


# ---------- 審查 ----------


def can_review(task: Task, member_id: str) -> bool:
    if task.state != "IN_REVIEW" or member_id == task.assignee_id:
        return False
    if task.policy.mode in ("leader", "pool"):
        return task.reviewer_id == member_id
    return member_id in task.policy.targets and member_id not in task.approvals


def _reviewer_only(task: Task, me: Member) -> None:
    if not can_review(task, me.id):
        raise ApiError("你目前不是這項任務的審查者", status=403, code="FORBIDDEN")


def _record_acceptance(
    store: MemoryStore,
    task: Task,
    me: Member,
    decision: Literal["approved", "changes"],
    reason: str,
    items: list[ReviewItemInput] | None,
) -> None:
    """記錄這次審查的決定與逐條判斷（沒有帶 items 時，每條只記錄驗收條件本身）"""
    criteria = task.acceptance_criteria
    if items is not None and len(items) != len(criteria):
        raise ApiError("逐條判斷的數量與驗收條件不一致", status=422, code="VALIDATION_ERROR")
    given = items or [ReviewItemInput(reviewer=None, note="") for _ in criteria]
    store.records.append(
        AcceptanceRecord(
            id=str(uuid.uuid4()),
            task_id=task.id,
            items=[
                AcceptanceItem(ac=ac, ai=it.ai or "unclear", evidence=it.evidence, reviewer=it.reviewer, note=it.note)
                for ac, it in zip(criteria, given, strict=True)
            ],
            decision=decision,
            reason=reason,
            reviewer_id=me.id,
            at=datetime.now(UTC).isoformat(),  # 含微秒：同一秒內的多筆紀錄，重新載入後順序不變
        )
    )


def claim_review(store: MemoryStore, me: Member, task_id: str) -> Task:
    task = store.find_task(task_id)
    _expect_state(task, ("IN_REVIEW",), "認領審查")
    if task.policy.mode != "pool":
        raise ApiError("這項任務不是公共池審查", status=409, code="INVALID_STATE")
    if task.assignee_id == me.id:
        raise ApiError("不能審查自己的任務", status=403, code="FORBIDDEN")
    if task.reviewer_id:
        raise ApiError("已被其他成員認領", status=409, code="CONFLICT")
    task.reviewer_id = me.id
    task.claimed_at = _now()
    store.resolve_notifications(task.id, ["pool"])
    return task


def approve_review(store: MemoryStore, me: Member, task_id: str, body: ApproveReviewBody) -> ReviewResult:
    task = store.find_task(task_id)
    _reviewer_only(task, me)
    _record_acceptance(store, task, me, "approved", "", body.items)
    policy = task.policy
    if policy.mode == "target":
        task.approvals = [*task.approvals, me.id]
        for n in store.notifications:  # 我自己的審查通知處理完了
            if n.task_id == task.id and n.to_id == me.id and n.status == "pending":
                n.status = "done"
        if policy.rule == "all" and len(task.approvals) < len(policy.targets):
            return ReviewResult(completed=False, approvals=len(task.approvals), required=len(policy.targets))
    task.state = "DONE"
    store.resolve_notifications(task.id, ["review", "pool"])
    store.notify(task.assignee_id, "info", task.id, me.id, "審查通過，任務已完成")
    return ReviewResult(completed=True, approvals=len(task.approvals), required=len(policy.targets))


def request_changes(store: MemoryStore, me: Member, task_id: str, body: RequestChangesBody) -> Task:
    note = body.note.strip()
    if not note:
        raise ApiError("要求修改時請填寫意見", status=422, code="VALIDATION_ERROR")
    task = store.find_task(task_id)
    _reviewer_only(task, me)
    _record_acceptance(store, task, me, "changes", note, body.items)
    task.state = "IN_PROGRESS"
    task.reviewer_id = None
    task.claimed_at = None
    task.approvals = []
    store.resolve_notifications(task.id, ["review", "pool"])
    store.notify(task.assignee_id, "info", task.id, me.id, f"要求修改：{note}")
    return task


# ---------- Sprint 啟動與結束 ----------


def _summary(store: MemoryStore, sprint_id: int) -> SprintSummary:
    tasks = [t for t in store.sprint_tasks(sprint_id) if t.state != "DEFERRED"]
    return SprintSummary(
        total=sum(t.story_points for t in tasks),
        done=sum(t.story_points for t in tasks if t.state == "DONE"),
        tasks=len(tasks),
    )


def start_sprint(store: MemoryStore, sprint_id: int) -> StartSprintResult:
    """啟動規劃中的 Sprint：所有任務都被成員接受、上一輪帶入／延後的決定都被確認後，
    上一輪未完成的任務依決定帶入（改派、改點數）或延後到延續事項，本輪任務進入待辦"""
    sprint = store.find_sprint(sprint_id)
    if sprint.status != "planning":
        raise ApiError("只有規劃中的 Sprint 可以啟動", status=409, code="INVALID_STATE")
    ready = store.plan_tasks(sprint_id)
    if not ready:
        raise ApiError("這個 Sprint 還沒有任務", status=409, code="SPRINT_NOT_READY")
    waiting = [t.id for t in ready if t.state != "ASSIGNED"]
    if waiting:
        raise ApiError(f"仍有任務未被成員接受：{'、'.join(waiting)}", status=409, code="SPRINT_NOT_READY")
    prev_id = store.prev_sprint_id(sprint_id)
    prev_tasks = store.sprint_tasks(prev_id) if prev_id is not None else []
    unconfirmed = [t.id for t in prev_tasks if is_unfinished(t) and t.carry_status not in (None, "accepted")]
    if unconfirmed:
        raise ApiError(
            f"仍有上輪任務的帶入或延後決定未被成員確認：{'、'.join(unconfirmed)}", status=409, code="SPRINT_NOT_READY"
        )

    carried = deferred = 0
    if prev_id is not None:
        prev = store.find_sprint(prev_id)
        prev.summary = _summary(store, prev_id)
        for t in prev_tasks:
            if not is_unfinished(t):
                continue
            if t.carry is not False:  # 尚未決定的任務視為帶入
                t.assignee_id = carry_owner(t)
                t.story_points = carry_points(t)
                t.sprint_id = sprint_id
                carried += 1
            else:
                defer_task(store, t, prev.name, f"{t.id} {t.title}")
                deferred += 1
            t.carry = None
            t.carry_assignee_id = None
            t.carry_points = None
            t.carry_status = None
        prev.status = "closed"
    for other in store.sprints.values():  # 不會同時有兩個進行中的 Sprint
        if other.status == "active" and other.id != sprint_id:
            other.summary = _summary(store, other.id)
            other.status = "closed"

    # 延續事項：選擇移除的刪掉，繼續保留的下次規劃再決定
    store.backlog = [b for b in store.backlog if not (b.used_in_sprint_id is None and b.decision == "remove")]
    for b in store.backlog:
        if b.used_in_sprint_id is None:
            b.decision = None
    for t in ready:
        t.state = "TODO"
    sprint.status = "active"
    sprint.step = 5
    store.active_sprint_id = sprint_id
    store.planning_sprint_id = None
    return StartSprintResult(carried_over=carried, deferred=deferred)


def end_sprint(store: MemoryStore, sprint_id: int) -> EndSprintResult:
    sprint: Sprint = store.find_sprint(sprint_id)
    if sprint.status != "active":
        raise ApiError("只有進行中的 Sprint 可以結束", status=409, code="INVALID_STATE")
    sprint.summary = _summary(store, sprint_id)
    sprint.status = "closed"
    return EndSprintResult(unfinished=sum(1 for t in store.sprint_tasks(sprint_id) if is_unfinished(t)))
