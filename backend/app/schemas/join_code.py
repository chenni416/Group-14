"""邀請碼加入的輸入輸出格式，對應前端 types/join-code.ts"""

from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel
from app.schemas.member import MemberRole

JoinRequestStatus = Literal["pending", "approved", "rejected", "cancelled"]


class JoinCode(ApiModel):
    """專案目前有效的邀請碼（Leader 看得到）"""

    code: str
    role: MemberRole
    """經同意加入後的角色"""
    expires_at: datetime | None
    created_at: datetime


class CreateJoinCodeInput(ApiModel):
    role: MemberRole = "Member"
    expires_in_days: int | None = 7
    """幾天後過期；為空表示不會過期"""


class SubmitJoinCodeInput(ApiModel):
    code: str


class JoinRequest(ApiModel):
    """用邀請碼送出的加入申請"""

    id: str
    project_id: str
    project_name: str
    member_id: str
    member_name: str
    github_login: str
    avatar_url: str
    status: JoinRequestStatus
    created_at: datetime
