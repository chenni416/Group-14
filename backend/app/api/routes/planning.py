"""Sprint 規劃 API，對應前端 contracts.ts 的 planning。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
- frontend/src/mocks/handlers/planning.ts
- frontend/src/mocks/handlers/decompose.ts
- frontend/src/mocks/handlers/assign.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.planning import GenerateDraftInput, GenerateTasksInput, PlanningDraft, StoryAssistantBody, TaskDraft
from app.schemas.sprint import CreatedResult, DeferredResult, UpdatedResult
from app.schemas.task import CountResult

router = APIRouter(tags=["Sprint 規劃"])


@router.get(
    "/planning/minutes/sample", operation_id="planning.getSampleMinutes", summary="範例會議紀錄", response_model=str
)
async def get_sample_minutes() -> str:
    raise not_implemented("planning.getSampleMinutes")


@router.post(
    "/planning/drafts",
    operation_id="planning.generateDraft",
    summary="AI 分析會議紀錄，產生 Story 切分草稿",
    response_model=PlanningDraft,
)
async def generate_draft(body: GenerateDraftInput) -> PlanningDraft:
    raise not_implemented("planning.generateDraft")


@router.post(
    "/planning/drafts/tasks",
    operation_id="planning.generateTasks",
    summary="依確認後的 Story 拆解 Task",
    response_model=list[TaskDraft],
)
async def generate_tasks(body: GenerateTasksInput) -> list[TaskDraft]:
    raise not_implemented("planning.generateTasks")


@router.post(
    "/planning/drafts/submit",
    operation_id="planning.submitPlan",
    summary="核准規劃：建立任務並發送指派邀請",
    response_model=CountResult,
)
async def submit_plan(body: PlanningDraft) -> CountResult:
    raise not_implemented("planning.submitPlan")


@router.post(
    "/planning/drafts/chat",
    operation_id="planning.askStoryAssistant",
    summary="與 AI 對話微調 Story 切分",
    response_model=str,
)
async def ask_story_assistant(body: StoryAssistantBody) -> str:
    raise not_implemented("planning.askStoryAssistant")


@router.post(
    "/sprints/{sprint_id}/decompose",
    operation_id="planning.decompose",
    summary="AI 拆解規劃中 Sprint 的會議紀錄，回傳新增數",
    response_model=CreatedResult,
)
async def decompose(sprint_id: int) -> CreatedResult:
    raise not_implemented("planning.decompose")


@router.post(
    "/sprints/{sprint_id}/defer-suggested",
    operation_id="planning.deferSuggested",
    summary="依 AI 容量建議延後任務",
    response_model=DeferredResult,
)
async def defer_suggested(sprint_id: int) -> DeferredResult:
    raise not_implemented("planning.deferSuggested")


@router.post(
    "/sprints/{sprint_id}/rebalance",
    operation_id="planning.rebalance",
    summary="AI 重新平衡指派（只調整 Leader 沒動過的草稿）",
    response_model=UpdatedResult,
)
async def rebalance(sprint_id: int) -> UpdatedResult:
    raise not_implemented("planning.rebalance")
