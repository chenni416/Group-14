"""成員協商退回之後的處理，以及延後或調整的回覆、審查策略修改。

規則移植自前端 services/mock/tasks.ts（resend、resendCarry、resetReturn、revise、confirmPlan、updatePolicy）與
lib/planning.ts（changesSinceReturn）。操作的是 MemoryStore；GitHub 登入的成員由 `ProjectStore` 載入與寫回資料庫。

與前端 mock 不同的地方：每個動作都檢查任務目前的狀態與角色，點數要在 1、2、3、5、8 之內，
指定的成員必須是專案成員（mock 沒有檢查，這裡補上，避免 API 被亂序或亂填呼叫）。
"""

from datetime import UTC, datetime

from app.core.errors import ApiError
from app.repo.memory import MemoryStore
from app.schemas.member import Member
from app.schemas.project import ReviewPolicy
from app.schemas.task import (
    PlanConfirm,
    PlanConfirmBody,
    ResendResult,
    ReviseTaskInput,
    SetCarryInput,
    Task,
)
from app.services.task_edit_flow import apply_carry, cap_of, normalize_policy, task_problems
from app.services.task_lifecycle import carry_confirmer, carry_points
from app.services.task_planning import TASK_POINT_OPTIONS

REVIEW_MODE_LABEL = {"leader": "Leader 專審", "pool": "團隊搶單認領", "target": "指定成員 / 領域"}


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def _name(store: MemoryStore, member_id: str) -> str:
    return next((m.name for m in store.members if m.id == member_id), member_id)


def _expect(cond: bool, message: str, *, status: int = 409, code: str = "INVALID_STATE") -> None:
    if not cond:
        raise ApiError(message, status=status, code=code)


def _invalid(cond: bool, message: str) -> None:
    _expect(cond, message, status=422, code="VALIDATION_ERROR")


def _check_policy(store: MemoryStore, policy: ReviewPolicy) -> ReviewPolicy:
    clean = normalize_policy(policy)
    for target in clean.targets:
        store.find_member(target)
    return clean


def changes_since_return(store: MemoryStore, t: Task) -> list[str]:
    """Leader 在協商退回後修改了哪些地方（與前端 changesSinceReturn 相同）"""
    s = t.return_snapshot
    if s is None:
        return []
    out: list[str] = []
    if s.title != t.title:
        out.append(f"標題改為「{t.title}」")
    if s.story_points != t.story_points:
        out.append(f"點數 {s.story_points} → {t.story_points}")
    elif s.story_points_reason != t.story_points_reason:
        out.append("估點理由已更新")
    if s.acceptance_criteria != t.acceptance_criteria:
        out.append("驗收條件已調整")
    if s.assignee_id != t.assignee_id:
        out.append(f"負責人 {_name(store, s.assignee_id)} → {_name(store, t.assignee_id)}")
    if s.policy.mode != t.policy.mode or s.policy.rule != t.policy.rule or s.policy.targets != t.policy.targets:
        out.append(f"Review 改為{REVIEW_MODE_LABEL[t.policy.mode]}")
    return out


# ---------- Leader：處理協商退回 ----------


def resend(store: MemoryStore, me: Member, task_id: str) -> ResendResult:
    """修改後發送給目前負責人"""
    sprint = store.planning_sprint()
    task = store.find_task(task_id)
    _expect(task.state == "RETURNED", "這個任務不在協商退回狀態")
    problems = task_problems(task)
    _invalid(not problems, f"{task.id}：{'、'.join(problems)}")
    member = store.find_member(task.assignee_id)
    load = store.planned_load(sprint.id).get(member.id, 0)
    _expect(load <= cap_of(sprint, member), f"{member.name} 超過點數上限，請調整點數或改派", code="OVER_CAPACITY")
    changes = changes_since_return(store, task)
    same = task.assignee_id == (task.negotiation.by_id if task.negotiation else None)
    _invalid(not same or bool(changes), "請先調整內容（例如點數、驗收條件）再發送給同一位成員")
    store.resolve_notifications(task.id, ["returned"])
    task.state = "PENDING_MEMBER"
    task.negotiation = None
    task.return_snapshot = None
    head = "已依你的協商調整後重新指派" if same else f"預估 {task.story_points} 點（重新指派）"
    detail = f"：{'、'.join(changes)}" if changes else ""
    store.notify(task.assignee_id, "invite", task.id, me.id, f"{head}{detail}，請確認是否接受")
    return ResendResult(task=task, changes=changes)


def reset_return(store: MemoryStore, task_id: str) -> Task:
    """復原到退回當下的內容"""
    task = store.find_task(task_id)
    snap = task.return_snapshot
    if snap is None or task.state != "RETURNED":
        raise ApiError("沒有可復原的內容", status=409, code="INVALID_STATE")
    task.title = snap.title
    task.acceptance_criteria = list(snap.acceptance_criteria)
    task.story_points = snap.story_points
    task.story_points_reason = snap.story_points_reason
    task.assignee_id = snap.assignee_id
    task.policy = snap.policy.model_copy(deep=True)
    return task


def revise(store: MemoryStore, me: Member, task_id: str, body: ReviseTaskInput) -> Task:
    """編輯任務並重新發送指派邀請"""
    task = store.find_task(task_id)
    _expect(task.state == "RETURNED", "只有協商退回的任務可以重新派工")
    title = body.title.strip()
    _invalid(bool(title), "請輸入任務標題")
    criteria = [c.strip() for c in body.acceptance_criteria if c.strip()]
    _invalid(bool(criteria), "至少需要一條驗收條件")
    _invalid(body.story_points in TASK_POINT_OPTIONS, f"點數只能是 {'、'.join(map(str, TASK_POINT_OPTIONS))}")
    policy = _check_policy(store, body.policy)
    _invalid(policy.mode != "target" or bool(policy.targets), "請選擇指定的審查成員")
    store.find_member(body.assignee_id)
    store.resolve_notifications(task.id, ["returned"])
    task.title = title
    task.story_points = body.story_points
    task.acceptance_criteria = criteria
    task.assignee_id = body.assignee_id
    task.policy = policy
    task.edited = True
    task.state = "PENDING_MEMBER"
    task.negotiation = None
    task.return_snapshot = None
    text = f"預估 {task.story_points} 點（Leader 已依協商調整），請確認是否接受"
    store.notify(body.assignee_id, "invite", task.id, me.id, text)
    return task


def _carry_invite_text(task: Task) -> str:
    if task.carry:
        return f"上輪未完成，Leader 評估本輪需要 {carry_points(task)} 點完成，將帶入下個 Sprint，請確認是否接受"
    return "上輪未完成，Leader 決定延後到之後的 Sprint，請確認"


def resend_carry(store: MemoryStore, me: Member, task_id: str, body: SetCarryInput) -> Task:
    """上輪任務的帶入／延後決定被協商退回後，Leader 修改並重新發送"""
    task = store.find_task(task_id)
    _expect(task.carry_status == "returned", "這個任務的決定沒有被協商退回")
    _invalid(body.carry is not None, "請選擇帶入本輪或延後")

    def signature() -> tuple[bool | None, str, int | None]:
        return task.carry, carry_confirmer(task), carry_points(task) if task.carry else None

    before = signature()
    apply_carry(store, task, body)
    _invalid(signature() != before, "請先改為延後、改派其他成員或調整點數，再重新發送")
    store.resolve_notifications(task.id, ["returned"])
    task.carry_status = "pending"
    task.negotiation = None
    store.notify(carry_confirmer(task), "invite", task.id, me.id, f"{_carry_invite_text(task)}（Leader 已依協商調整）")
    return task


# ---------- 成員與 Leader ----------


def confirm_plan(store: MemoryStore, me: Member, task_id: str, body: PlanConfirmBody) -> Task:
    """被影響的負責人回覆延後或調整：同意或提出異議"""
    task = store.find_task(task_id)
    _expect(task.assignee_id == me.id, "只有被影響的負責人可以回覆", status=403, code="FORBIDDEN")
    note = body.note.strip()
    _invalid(body.status != "object" or bool(note), "提出異議時請填寫原因")
    task.plan_confirms = [*task.plan_confirms, PlanConfirm(member_id=me.id, status=body.status, note=note, at=_now())]
    store.resolve_notifications(task.id, ["plan"])
    text = "同意延後或調整" if body.status == "agree" else f"對延後或調整提出異議：{note}"
    for leader in (m for m in store.members if m.role == "Leader" and m.id != me.id):
        store.notify(leader.id, "info", task.id, me.id, text)
    return task


def update_policy(store: MemoryStore, me: Member, task_id: str, policy: ReviewPolicy) -> Task:
    """修改審查策略：Leader 或負責人，進入審查後鎖定"""
    task = store.find_task(task_id)
    allowed = me.role == "Leader" or task.assignee_id == me.id
    _expect(allowed, "只有 Leader 或負責人可以調整", status=403, code="FORBIDDEN")
    _expect(task.state not in ("IN_REVIEW", "DONE"), "審查中已鎖定")
    task.policy = _check_policy(store, policy)
    task.policy_reason = ""
    return task
