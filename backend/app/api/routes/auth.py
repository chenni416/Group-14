"""登入 API，對應前端 contracts.ts 的 auth。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts

登入流程由前端與 Supabase Auth 完成，後端只驗證 token（見 app/core/auth.py）。
"""

from fastapi import APIRouter

from app.api.deps import Db
from app.core.auth import AccountMember
from app.core.config import get_settings
from app.core.errors import ApiError, not_implemented
from app.schemas.member import Member, SwitchUserInput, UpdateMeInput
from app.services import members

router = APIRouter(tags=["登入"])


@router.get("/me", operation_id="auth.me", summary="目前登入的成員", response_model=Member)
def me(member: AccountMember, db: Db) -> Member:
    # 第一次登入時 get_current_member 會建立成員；這裡另外記錄最後登入時間
    members.touch_login(db, member.id)
    return member


@router.patch("/me", operation_id="auth.updateMe", summary="修改自己的顯示名稱", response_model=Member)
def update_me(body: UpdateMeInput, member: AccountMember, db: Db) -> Member:
    row = members.update_display_name(db, member.id, body.display_name)
    # 只改顯示名稱，專案內的角色與設定沿用目前的值
    return members.to_schema(row).model_copy(
        update={k: getattr(member, k) for k in ("role", "title", "domain", "tags", "capacity")}
    )


@router.post(
    "/auth/switch",
    operation_id="auth.switchUser",
    summary="開發用：切換示範身分（真實登入上線後移除）",
    response_model=Member,
)
async def switch_user(body: SwitchUserInput) -> Member:
    # 正式環境一律使用真正的登入，不提供切換身分
    if get_settings().app_env != "development":
        raise ApiError("找不到這個端點", status=404, code="NOT_FOUND")
    raise not_implemented("auth.switchUser")
