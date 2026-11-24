"""成員邀請（指定 GitHub 帳號）的輸入輸出格式，對應前端 types/invitation.ts"""

from datetime import datetime
from typing import Literal

from app.schemas.base import ApiModel
from app.schemas.member import Domain, MemberRole

InvitationStatus = Literal["pending", "accepted", "declined", "revoked"]


class Invitation(ApiModel):
    id: str
    project_id: str
    project_name: str
    github_login: str
    """被邀請的 GitHub 帳號（小寫）"""
    role: MemberRole
    title: str
    domain: Domain | None
    capacity: int
    status: InvitationStatus
    invited_by_name: str
    """邀請人的顯示名稱"""
    created_at: datetime


class CreateInvitationInput(ApiModel):
    github_login: str
    role: MemberRole = "Member"
    title: str = ""
    domain: Domain | None = None
    capacity: int = 0
