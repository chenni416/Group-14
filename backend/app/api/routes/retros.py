"""回顧 API，對應前端 contracts.ts 的 retros。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.collab import AddRetroActionInput, Retro, SubmitRetroEntryInput

router = APIRouter(tags=["回顧"])


@router.get("/sprints/{sprint_id}/retro", operation_id="retros.get", summary="單一 Sprint 的回顧", response_model=Retro)
async def get_retros(sprint_id: int) -> Retro:
    raise not_implemented("retros.get")


@router.get("/retros", operation_id="retros.list", summary="所有回顧", response_model=list[Retro])
async def list_retros() -> list[Retro]:
    raise not_implemented("retros.list")


@router.post(
    "/sprints/{sprint_id}/retro/entries",
    operation_id="retros.submitEntry",
    summary="送出個人回顧",
    response_model=Retro,
)
async def submit_entry(sprint_id: int, body: SubmitRetroEntryInput) -> Retro:
    raise not_implemented("retros.submitEntry")


@router.post(
    "/sprints/{sprint_id}/retro/actions", operation_id="retros.addAction", summary="新增改善行動", response_model=Retro
)
async def add_action(sprint_id: int, body: AddRetroActionInput) -> Retro:
    raise not_implemented("retros.addAction")


@router.post(
    "/sprints/{sprint_id}/retro/actions/{action_id}/toggle",
    operation_id="retros.toggleAction",
    summary="切換改善行動完成狀態",
    response_model=Retro,
)
async def toggle_action(sprint_id: int, action_id: str) -> Retro:
    raise not_implemented("retros.toggleAction")


@router.post("/sprints/{sprint_id}/retro/close", operation_id="retros.close", summary="結束回顧", response_model=Retro)
async def close(sprint_id: int) -> Retro:
    raise not_implemented("retros.close")
