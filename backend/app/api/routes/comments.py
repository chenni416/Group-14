"""任務留言 API，對應前端 contracts.ts 的 comments。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.collab import AddCommentInput, TaskComment

router = APIRouter(tags=["任務留言"])


@router.get(
    "/tasks/{task_id}/comments", operation_id="comments.list", summary="任務留言列表", response_model=list[TaskComment]
)
async def list_comments(task_id: str) -> list[TaskComment]:
    raise not_implemented("comments.list")


@router.post(
    "/tasks/{task_id}/comments",
    operation_id="comments.add",
    summary="新增留言，@ 標注的成員會收到通知",
    response_model=TaskComment,
)
async def add(task_id: str, body: AddCommentInput) -> TaskComment:
    raise not_implemented("comments.add")


@router.post(
    "/tasks/{task_id}/comments/read",
    operation_id="comments.markRead",
    summary="把目前登入者在這項任務的 @ 通知標為已處理",
    status_code=204,
)
async def mark_read(task_id: str) -> None:
    raise not_implemented("comments.markRead")
