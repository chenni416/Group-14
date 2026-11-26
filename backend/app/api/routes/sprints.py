"""Sprint API，對應前端 contracts.ts 的 sprints。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
- frontend/src/mocks/handlers/sprint.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.ai.llm import Llm
from app.core.auth import CurrentMember, require_leader
from app.core.errors import not_implemented
from app.repo import Store
from app.schemas.sprint import (
    AddSprintDocsBody,
    AnalyzeBody,
    AnalyzeResult,
    AnswerBody,
    BacklogDecisionBody,
    BacklogItem,
    BurndownPoint,
    CreateSprintInput,
    Dependency,
    EndSprintResult,
    NewSprintDefaults,
    Sprint,
    StartSprintResult,
    UpdateSprintInput,
)
from app.services import planning_flow, sprint_flow

router = APIRouter(tags=["Sprint"])


@router.get("/sprints", operation_id="sprints.list", summary="Sprint 列表", response_model=list[Sprint])
async def list_sprints(store: Store) -> list[Sprint]:
    return sprint_flow.list_sprints(store)


@router.get(
    "/sprints/defaults",
    operation_id="sprints.defaults",
    summary="建立 Sprint 的預設值（日期、Capacity、已帶入延續事項的會議紀錄）",
    response_model=NewSprintDefaults,
)
async def defaults(store: Store) -> NewSprintDefaults:
    return sprint_flow.defaults(store)


@router.post("/sprints", operation_id="sprints.create", summary="建立 Sprint", response_model=Sprint)
async def create(body: CreateSprintInput, store: Store, me: CurrentMember) -> Sprint:
    require_leader(me)
    return sprint_flow.create(store, body)


@router.patch(
    "/sprints/{sprint_id}", operation_id="sprints.update", summary="修改規劃中 Sprint 的設定", response_model=Sprint
)
async def update(sprint_id: int, body: UpdateSprintInput, store: Store, me: CurrentMember) -> Sprint:
    require_leader(me)
    return sprint_flow.update(store, sprint_id, body)


@router.post(
    "/sprints/{sprint_id}/docs", operation_id="sprints.addDocs", summary="加入本次文件資料", response_model=Sprint
)
async def add_docs(sprint_id: int, body: AddSprintDocsBody, store: Store, me: CurrentMember) -> Sprint:
    require_leader(me)
    return sprint_flow.add_docs(store, sprint_id, body)


@router.post(
    "/sprints/{sprint_id}/analyze",
    operation_id="sprints.analyze",
    summary="AI 分析會議紀錄，產生待釐清問題，回傳未回答數",
    response_model=AnalyzeResult,
)
def analyze(sprint_id: int, body: AnalyzeBody, store: Store, me: CurrentMember, llm: Llm) -> AnalyzeResult:
    require_leader(me)
    return planning_flow.analyze(store, sprint_id, body.minutes, llm)


@router.put(
    "/sprints/{sprint_id}/questions/{question_id}",
    operation_id="sprints.answer",
    summary="回答待釐清問題",
    response_model=Sprint,
)
async def answer(sprint_id: int, question_id: str, body: AnswerBody, store: Store, me: CurrentMember) -> Sprint:
    require_leader(me)
    return planning_flow.answer_question(store, sprint_id, question_id, body.answer)


@router.post(
    "/sprints/{sprint_id}/end",
    operation_id="sprints.end",
    summary="結束進行中的 Sprint 並開啟回顧，回傳未完成任務數",
    response_model=EndSprintResult,
)
async def end(sprint_id: int) -> EndSprintResult:
    raise not_implemented("sprints.end")


@router.post(
    "/sprints/{sprint_id}/start",
    operation_id="sprints.start",
    summary="啟動 Sprint：上個 Sprint 的未完成任務依選擇帶入或延後",
    response_model=StartSprintResult,
)
async def start(sprint_id: int) -> StartSprintResult:
    raise not_implemented("sprints.start")


@router.get(
    "/sprints/{sprint_id}/burndown",
    operation_id="sprints.burndown",
    summary="燃盡圖資料",
    response_model=list[BurndownPoint],
)
async def burndown(sprint_id: int) -> list[BurndownPoint]:
    raise not_implemented("sprints.burndown")


@router.get("/backlog", operation_id="sprints.backlog", summary="延續事項", response_model=list[BacklogItem])
async def backlog(store: Store) -> list[BacklogItem]:
    return store.backlog


@router.put(
    "/backlog/{id}/decision",
    operation_id="sprints.decideBacklog",
    summary="上輪統整：延續事項納入本輪、繼續保留或移除",
    response_model=BacklogItem,
)
async def decide_backlog(id: str, body: BacklogDecisionBody, store: Store, me: CurrentMember) -> BacklogItem:
    require_leader(me)
    return sprint_flow.decide_backlog(store, id, body.decision)


@router.delete("/backlog/{id}", operation_id="sprints.removeBacklog", summary="移除延續事項", status_code=204)
async def remove_backlog(id: str, store: Store, me: CurrentMember) -> None:
    require_leader(me)
    sprint_flow.remove_backlog(store, id)


@router.get(
    "/sprints/{sprint_id}/dependencies",
    operation_id="sprints.dependencies",
    summary="相依性分析：本次任務與上一個 Sprint 的相依",
    response_model=list[Dependency],
)
async def dependencies(sprint_id: int, store: Store) -> list[Dependency]:
    return planning_flow.dependencies(store, sprint_id)
