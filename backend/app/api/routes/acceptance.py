"""驗收 API，對應前端 contracts.ts 的 acceptance。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts
- frontend/src/mocks/handlers/acceptance.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.ai.llm import Llm
from app.api.deps import ProjectStore
from app.core.errors import not_implemented
from app.schemas.acceptance import AcceptanceCheck, AcceptanceRecord
from app.services import task_flow

router = APIRouter(tags=["驗收"])


@router.post(
    "/tasks/{task_id}/acceptance/check",
    operation_id="acceptance.check",
    summary="AI 驗收檢查",
    response_model=AcceptanceCheck,
)
def check(task_id: str, store: ProjectStore, llm: Llm) -> AcceptanceCheck:
    return task_flow.check_acceptance(store, task_id, llm)


@router.get(
    "/tasks/{task_id}/acceptance/records",
    operation_id="acceptance.records",
    summary="驗收紀錄",
    response_model=list[AcceptanceRecord],
)
async def records(task_id: str) -> list[AcceptanceRecord]:
    raise not_implemented("acceptance.records")
