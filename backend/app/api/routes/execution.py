"""執行計畫 API，對應前端 contracts.ts 的 execution。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts
- frontend/src/mocks/handlers/execution.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from datetime import date

from fastapi import APIRouter

from app.ai.llm import Llm
from app.api.deps import ProjectStore
from app.core.auth import CurrentMember
from app.core.errors import not_implemented
from app.schemas.collab import ExecutionPlan, SaveExecutionPlanInput
from app.services import task_flow

router = APIRouter(tags=["執行計畫"])


@router.get(
    "/execution-plans", operation_id="execution.list", summary="所有執行計畫", response_model=list[ExecutionPlan]
)
def list_execution(store: ProjectStore, me: CurrentMember) -> list[ExecutionPlan]:
    return list(store.plans.values())


@router.get(
    "/tasks/{task_id}/execution-plan",
    operation_id="execution.get",
    summary="單一任務的執行計畫；沒有時回傳 null",
    response_model=ExecutionPlan | None,
)
def get_execution(task_id: str, store: ProjectStore, me: CurrentMember) -> ExecutionPlan | None:
    store.find_task(task_id)  # 任務不存在時回 404
    return store.plans.get(task_id)


@router.post(
    "/tasks/{task_id}/execution-plan/suggest",
    operation_id="execution.suggest",
    summary="AI 依任務規格、依賴與專案文件產生計畫建議",
    response_model=ExecutionPlan,
)
def suggest(task_id: str, store: ProjectStore, me: CurrentMember, llm: Llm) -> ExecutionPlan:
    return task_flow.suggest_execution_plan(store, task_id, me, llm, date.today())


@router.put(
    "/tasks/{task_id}/execution-plan",
    operation_id="execution.save",
    summary="儲存執行計畫",
    response_model=ExecutionPlan,
)
async def save(task_id: str, body: SaveExecutionPlanInput) -> ExecutionPlan:
    raise not_implemented("execution.save")


@router.post(
    "/tasks/{task_id}/execution-plan/confirm",
    operation_id="execution.confirm",
    summary="確認執行計畫",
    response_model=ExecutionPlan,
)
async def confirm(task_id: str) -> ExecutionPlan:
    raise not_implemented("execution.confirm")


@router.post(
    "/tasks/{task_id}/execution-plan/items/{item_id}/toggle",
    operation_id="execution.toggleItem",
    summary="切換 Checklist 項目完成狀態",
    response_model=ExecutionPlan,
)
async def toggle_item(task_id: str, item_id: str) -> ExecutionPlan:
    raise not_implemented("execution.toggleItem")


@router.post(
    "/tasks/{task_id}/execution-plan/checkpoints/{checkpoint_id}/toggle",
    operation_id="execution.toggleCheckpoint",
    summary="切換 Checkpoint 達成狀態",
    response_model=ExecutionPlan,
)
async def toggle_checkpoint(task_id: str, checkpoint_id: str) -> ExecutionPlan:
    raise not_implemented("execution.toggleCheckpoint")
