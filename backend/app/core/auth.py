"""登入與權限（空殼）。

預計做法：前端以 Supabase Auth（GitHub 登入）取得 JWT，放在 Authorization: Bearer 標頭；
後端只負責驗證 JWT，再對應到 members 資料表。之後若改為自行實作 GitHub OAuth，只需替換這一層。
"""

from typing import Annotated

from fastapi import Depends, Header

from app.core.errors import ApiError
from app.schemas.member import Member


async def get_current_member(authorization: Annotated[str | None, Header()] = None) -> Member:
    """驗證 Bearer token 並回傳目前登入的成員。

    TODO：
    1. 以 settings.supabase_jwt_secret 驗證 JWT（簽章、過期時間）
    2. 用 JWT 的 sub（Supabase user id）查出對應的成員
    """
    if not authorization:
        raise ApiError("請先登入", status=401, code="UNAUTHORIZED")
    raise ApiError("登入驗證尚未實作", status=501, code="NOT_IMPLEMENTED")


def require_leader(member: Member) -> None:
    """Leader 限定的操作（派工、決策等）呼叫此函式檢查"""
    if member.role != "Leader":
        raise ApiError("只有 Leader 可以執行這個操作", status=403, code="FORBIDDEN")


CurrentMember = Annotated[Member, Depends(get_current_member)]
