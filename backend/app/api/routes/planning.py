"""Sprint 規劃 API，對應前端 contracts.ts 的 planning。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
- frontend/src/mocks/handlers/planning.ts
- frontend/src/mocks/handlers/decompose.ts
- frontend/src/mocks/handlers/assign.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.ai.llm import Llm
from app.core.auth import CurrentMember, require_leader
from app.core.errors import not_implemented
from app.ports import Members
from app.repo import Store
from app.schemas.planning import GenerateDraftInput, GenerateTasksInput, PlanningDraft, StoryAssistantBody, TaskDraft
from app.schemas.sprint import CreatedResult, DeferredResult, UpdatedResult
from app.schemas.task import CountResult
from app.services import planning_flow, task_planning

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
def generate_draft(body: GenerateDraftInput, store: Store, me: CurrentMember, llm: Llm) -> PlanningDraft:
    # 同步函式：FastAPI 會放到 thread pool 執行，不會因為等待 LLM 而卡住事件迴圈
    require_leader(me)
    return planning_flow.generate_draft(store, body, llm)


@router.post(
    "/planning/drafts/tasks",
    operation_id="planning.generateTasks",
    summary="依確認後的 Story 拆解 Task",
    response_model=list[TaskDraft],
)
def generate_tasks(body: GenerateTasksInput, members: Members, store: Store, llm: Llm) -> list[TaskDraft]:
    # [v0.2 修改] 規劃工作室的草稿由前端持有，這裡帶入資料層中已確定的負載（上一輪帶入＋本輪已確定的任務），
    # 讓指派建議不會把帶入任務的負責人當成沒事做
    loads = store.committed_load(body.sprint_id) if body.sprint_id in store.sprints else {}
    return task_planning.generate_tasks(body, members, llm, loads=loads)


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
def ask_story_assistant(body: StoryAssistantBody, store: Store, me: CurrentMember, llm: Llm) -> str:
    # [v0.2 修改] Story 草稿由前端持有、不存在資料層，所以改由前端在請求中帶上目前的 Story（body.stories）。
    # 修改前這裡固定傳入空陣列，模型看不到任何 Story；舊版前端沒帶 stories 時仍維持空陣列。
    require_leader(me)
    return task_planning.story_assistant_reply(
        body, goal=store.planning_sprint().goal, stories=body.stories or [], llm=llm
    )


@router.post(
    "/sprints/{sprint_id}/decompose",
    operation_id="planning.decompose",
    summary="AI 拆解規劃中 Sprint 的會議紀錄，回傳新增數",
    response_model=CreatedResult,
)
def decompose(sprint_id: int, store: Store, me: CurrentMember, llm: Llm) -> CreatedResult:
    require_leader(me)
    return CreatedResult(created=planning_flow.decompose(store, sprint_id, llm))


@router.post(
    "/sprints/{sprint_id}/defer-suggested",
    operation_id="planning.deferSuggested",
    summary="依 AI 容量建議延後任務",
    response_model=DeferredResult,
)
def defer_suggested(sprint_id: int, store: Store, me: CurrentMember, llm: Llm) -> DeferredResult:
    require_leader(me)
    return DeferredResult(deferred=planning_flow.defer_suggested(store, sprint_id, llm))


@router.post(
    "/sprints/{sprint_id}/rebalance",
    operation_id="planning.rebalance",
    summary="AI 重新平衡指派（只調整 Leader 沒動過的草稿）",
    response_model=UpdatedResult,
)
def rebalance(sprint_id: int, store: Store, me: CurrentMember, llm: Llm) -> UpdatedResult:
    require_leader(me)
    return UpdatedResult(updated=planning_flow.rebalance(store, sprint_id, llm))
