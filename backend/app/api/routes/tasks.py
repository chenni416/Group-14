"""任務 API，對應前端 contracts.ts 的 tasks。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.ai.llm import Llm
from app.core.auth import CurrentMember, require_leader
from app.core.errors import not_implemented
from app.repo import Store
from app.schemas.acceptance import SubmitDeliveryInput
from app.schemas.project import ReviewPolicy
from app.schemas.task import (
    ApproveReviewBody,
    CountResult,
    CreateTaskInput,
    NegotiateInput,
    PlanConfirmBody,
    RequestChangesBody,
    ResendResult,
    ReviewResult,
    ReviseTaskInput,
    SetCarryInput,
    SuggestAssigneeResult,
    Task,
    UpdateTaskInput,
)
from app.services import planning_flow, task_edit_flow

router = APIRouter(tags=["任務"])


@router.get("/tasks", operation_id="tasks.list", summary="任務列表", response_model=list[Task])
async def list_tasks(store: Store) -> list[Task]:
    return task_edit_flow.list_tasks(store)


@router.post("/tasks", operation_id="tasks.create", summary="新增任務", response_model=Task)
async def create(body: CreateTaskInput, store: Store, me: CurrentMember) -> Task:
    require_leader(me)
    return task_edit_flow.create_task(store, body)


@router.patch("/tasks/{id}", operation_id="tasks.update", summary="修改任務", response_model=Task)
async def update(id: str, body: UpdateTaskInput, store: Store, me: CurrentMember) -> Task:
    require_leader(me)
    return task_edit_flow.update_task(store, id, body)


@router.delete("/tasks/{id}", operation_id="tasks.remove", summary="刪除任務", status_code=204)
async def remove(id: str, store: Store, me: CurrentMember) -> None:
    require_leader(me)
    task_edit_flow.remove_task(store, id)


@router.post(
    "/tasks/drafts/approve",
    operation_id="tasks.approveDrafts",
    summary="核准所有草稿並發送指派邀請（先做核准前檢查），回傳數量",
    response_model=CountResult,
)
async def approve_drafts(store: Store, me: CurrentMember) -> CountResult:
    require_leader(me)
    return CountResult(count=task_edit_flow.approve_drafts(store, me))


@router.post(
    "/tasks/{id}/defer", operation_id="tasks.defer", summary="延後到下個 Sprint（記錄到延續事項）", response_model=Task
)
async def defer(id: str, store: Store, me: CurrentMember) -> Task:
    require_leader(me)
    return task_edit_flow.defer(store, me, id)


@router.post("/tasks/{id}/restore", operation_id="tasks.restore", summary="取消延後", response_model=Task)
async def restore(id: str, store: Store, me: CurrentMember) -> Task:
    require_leader(me)
    return task_edit_flow.restore(store, id)


@router.put(
    "/tasks/{id}/carry", operation_id="tasks.setCarry", summary="上輪未完成任務：帶入本輪或延後", response_model=Task
)
async def set_carry(id: str, body: SetCarryInput, store: Store, me: CurrentMember) -> Task:
    require_leader(me)
    return task_edit_flow.set_carry(store, id, body)


@router.post(
    "/tasks/{id}/carry/resend",
    operation_id="tasks.resendCarry",
    summary="成員協商退回帶入／延後決定後，Leader 修改並重新發送",
    response_model=Task,
)
async def resend_carry(id: str, body: SetCarryInput) -> Task:
    raise not_implemented("tasks.resendCarry")


@router.post(
    "/tasks/{id}/resend",
    operation_id="tasks.resend",
    summary="協商退回：修改後發送給目前負責人",
    response_model=ResendResult,
)
async def resend(id: str) -> ResendResult:
    raise not_implemented("tasks.resend")


@router.post(
    "/tasks/{id}/suggest-assignee",
    operation_id="tasks.suggestAssignee",
    summary="協商退回：AI 重新建議負責人（排除提出協商的成員）",
    response_model=SuggestAssigneeResult,
)
def suggest_assignee(id: str, store: Store, me: CurrentMember, llm: Llm) -> SuggestAssigneeResult:
    require_leader(me)
    return planning_flow.suggest_assignee(store, id, llm)


@router.post(
    "/tasks/{id}/reset-return",
    operation_id="tasks.resetReturn",
    summary="協商退回：復原到退回當下的內容",
    response_model=Task,
)
async def reset_return(id: str) -> Task:
    raise not_implemented("tasks.resetReturn")


@router.put(
    "/tasks/{id}/revise",
    operation_id="tasks.revise",
    summary="協商退回後編輯任務並重新發送指派邀請",
    response_model=Task,
)
async def revise(id: str, body: ReviseTaskInput) -> Task:
    raise not_implemented("tasks.revise")


@router.post("/tasks/{id}/accept", operation_id="tasks.accept", summary="成員接受任務", response_model=Task)
async def accept(id: str) -> Task:
    raise not_implemented("tasks.accept")


@router.post("/tasks/{id}/negotiate", operation_id="tasks.negotiate", summary="成員協商退回", response_model=Task)
async def negotiate(id: str, body: NegotiateInput) -> Task:
    raise not_implemented("tasks.negotiate")


@router.post(
    "/tasks/{id}/review/claim", operation_id="tasks.claimReview", summary="認領公共池的審查", response_model=Task
)
async def claim_review(id: str) -> Task:
    raise not_implemented("tasks.claimReview")


@router.post("/tasks/{id}/start", operation_id="tasks.startDevelopment", summary="開始開發", response_model=Task)
async def start_development(id: str) -> Task:
    raise not_implemented("tasks.startDevelopment")


@router.post(
    "/tasks/{id}/review", operation_id="tasks.submitForReview", summary="送審並提交交付內容", response_model=Task
)
async def submit_for_review(id: str, body: SubmitDeliveryInput | None = None) -> Task:
    raise not_implemented("tasks.submitForReview")


@router.post(
    "/tasks/{id}/review/approve",
    operation_id="tasks.approveReview",
    summary="核准審查；帶入 items 時一併記錄逐條驗收判斷",
    response_model=ReviewResult,
)
async def approve_review(id: str, body: ApproveReviewBody) -> ReviewResult:
    raise not_implemented("tasks.approveReview")


@router.post(
    "/tasks/{id}/review/request-changes", operation_id="tasks.requestChanges", summary="要求修改", response_model=Task
)
async def request_changes(id: str, body: RequestChangesBody) -> Task:
    raise not_implemented("tasks.requestChanges")


@router.post(
    "/tasks/{id}/plan-confirm", operation_id="tasks.confirmPlan", summary="成員對延後或調整的回覆", response_model=Task
)
async def confirm_plan(id: str, body: PlanConfirmBody) -> Task:
    raise not_implemented("tasks.confirmPlan")


@router.put("/tasks/{id}/policy", operation_id="tasks.updatePolicy", summary="修改審查策略", response_model=Task)
async def update_policy(id: str, body: ReviewPolicy) -> Task:
    raise not_implemented("tasks.updatePolicy")
