"""登入 API，對應前端 contracts.ts 的 auth。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.member import Member, SwitchUserInput

router = APIRouter(tags=["登入"])


@router.get("/me", operation_id="auth.me", summary="目前登入的成員", response_model=Member)
async def me() -> Member:
    raise not_implemented("auth.me")


@router.post(
    "/auth/switch",
    operation_id="auth.switchUser",
    summary="開發用：切換示範身分（真實登入上線後移除）",
    response_model=Member,
)
async def switch_user(body: SwitchUserInput) -> Member:
    raise not_implemented("auth.switchUser")
