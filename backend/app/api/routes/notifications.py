"""通知 API，對應前端 contracts.ts 的 notifications。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.auth import CurrentMember
from app.repo import Store
from app.schemas.collab import Notification
from app.services import workspace_flow

router = APIRouter(tags=["通知"])


@router.get(
    "/notifications", operation_id="notifications.list", summary="目前登入者的通知", response_model=list[Notification]
)
async def list_notifications(store: Store, me: CurrentMember) -> list[Notification]:
    return workspace_flow.list_notifications(store, me)
