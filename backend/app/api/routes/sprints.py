"""Sprint API，對應前端 contracts.ts 的 sprints。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
- frontend/src/mocks/handlers/sprint.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
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

router = APIRouter(tags=["Sprint"])


@router.get("/sprints", operation_id="sprints.list", summary="Sprint 列表", response_model=list[Sprint])
async def list_sprints() -> list[Sprint]:
    raise not_implemented("sprints.list")


@router.get(
    "/sprints/defaults",
    operation_id="sprints.defaults",
    summary="建立 Sprint 的預設值（日期、Capacity、已帶入延續事項的會議紀錄）",
    response_model=NewSprintDefaults,
)
async def defaults() -> NewSprintDefaults:
    raise not_implemented("sprints.defaults")


@router.post("/sprints", operation_id="sprints.create", summary="建立 Sprint", response_model=Sprint)
async def create(body: CreateSprintInput) -> Sprint:
    raise not_implemented("sprints.create")


@router.patch(
    "/sprints/{sprint_id}", operation_id="sprints.update", summary="修改規劃中 Sprint 的設定", response_model=Sprint
)
async def update(sprint_id: int, body: UpdateSprintInput) -> Sprint:
    raise not_implemented("sprints.update")


@router.post(
    "/sprints/{sprint_id}/docs", operation_id="sprints.addDocs", summary="加入本次文件資料", response_model=Sprint
)
async def add_docs(sprint_id: int, body: AddSprintDocsBody) -> Sprint:
    raise not_implemented("sprints.addDocs")


@router.post(
    "/sprints/{sprint_id}/analyze",
    operation_id="sprints.analyze",
    summary="AI 分析會議紀錄，產生待釐清問題，回傳未回答數",
    response_model=AnalyzeResult,
)
async def analyze(sprint_id: int, body: AnalyzeBody) -> AnalyzeResult:
    raise not_implemented("sprints.analyze")


@router.put(
    "/sprints/{sprint_id}/questions/{question_id}",
    operation_id="sprints.answer",
    summary="回答待釐清問題",
    response_model=Sprint,
)
async def answer(sprint_id: int, question_id: str, body: AnswerBody) -> Sprint:
    raise not_implemented("sprints.answer")


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
async def backlog() -> list[BacklogItem]:
    raise not_implemented("sprints.backlog")


@router.put(
    "/backlog/{id}/decision",
    operation_id="sprints.decideBacklog",
    summary="上輪統整：延續事項納入本輪、繼續保留或移除",
    response_model=BacklogItem,
)
async def decide_backlog(id: str, body: BacklogDecisionBody) -> BacklogItem:
    raise not_implemented("sprints.decideBacklog")


@router.delete("/backlog/{id}", operation_id="sprints.removeBacklog", summary="移除延續事項", status_code=204)
async def remove_backlog(id: str) -> None:
    raise not_implemented("sprints.removeBacklog")


@router.get(
    "/sprints/{sprint_id}/dependencies",
    operation_id="sprints.dependencies",
    summary="相依性分析：本次任務與上一個 Sprint 的相依",
    response_model=list[Dependency],
)
async def dependencies(sprint_id: int) -> list[Dependency]:
    raise not_implemented("sprints.dependencies")
