"""通知 API，對應前端 contracts.ts 的 notifications。

- GitHub 登入的成員：讀寫 notifications 資料表（app/services/notifications.py）
- 開發用的示範成員（X-Demo-User）：沿用記憶體版假資料（MemoryStore）

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
"""

from fastapi import APIRouter

from app.api.deps import Db
from app.core.auth import AccountMember
from app.repo import Store
from app.schemas.collab import Notification
from app.services import notifications, projects, workspace_flow

router = APIRouter(tags=["通知"])


@router.get(
    "/notifications", operation_id="notifications.list", summary="目前登入者的通知", response_model=list[Notification]
)
def list_notifications(store: Store, me: AccountMember, db: Db) -> list[Notification]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return workspace_flow.list_notifications(store, me)
    return notifications.list_mine(db, member_id)


@router.post(
    "/notifications/read-all", operation_id="notifications.markAllRead", summary="全部標為已讀", status_code=204
)
def mark_all_read(me: AccountMember, db: Db) -> None:
    member_id = projects.parse_uuid(me.id)
    if member_id is not None:
        notifications.mark_all_read(db, member_id)


@router.post("/notifications/{id}/read", operation_id="notifications.markRead", summary="標為已讀", status_code=204)
def mark_read(id: str, me: AccountMember, db: Db) -> None:
    member_id = projects.parse_uuid(me.id)
    if member_id is not None:
        notifications.mark_read(db, member_id, id)
