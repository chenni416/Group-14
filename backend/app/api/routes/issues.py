"""問題回報 API，對應前端 contracts.ts 的 issues。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts
- frontend/src/mocks/handlers/issues.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.collab import AssignIssueBody, Issue, ReportIssueInput, TextBody

router = APIRouter(tags=["問題回報"])


@router.get("/issues", operation_id="issues.list", summary="問題列表", response_model=list[Issue])
async def list_issues() -> list[Issue]:
    raise not_implemented("issues.list")


@router.post("/issues", operation_id="issues.report", summary="回報問題（系統推薦處理人並通知）", response_model=Issue)
async def report(body: ReportIssueInput) -> Issue:
    raise not_implemented("issues.report")


@router.post("/issues/{id}/assign", operation_id="issues.assign", summary="改派處理人", response_model=Issue)
async def assign(id: str, body: AssignIssueBody) -> Issue:
    raise not_implemented("issues.assign")


@router.post("/issues/{id}/respond", operation_id="issues.respond", summary="回應問題", response_model=Issue)
async def respond(id: str, body: TextBody) -> Issue:
    raise not_implemented("issues.respond")


@router.post("/issues/{id}/resolve", operation_id="issues.resolve", summary="標記已解決", response_model=Issue)
async def resolve(id: str) -> Issue:
    raise not_implemented("issues.resolve")


@router.post(
    "/issues/{id}/replan", operation_id="issues.replan", summary="需要重新規劃（通知 Leader）", response_model=Issue
)
async def replan(id: str) -> Issue:
    raise not_implemented("issues.replan")
