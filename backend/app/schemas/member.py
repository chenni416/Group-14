"""成員。對應 frontend/src/types/member.ts"""

from typing import Literal

from app.schemas.base import ApiModel

Domain = Literal["FE", "BE", "AI", "QA", "DS"]
MemberRole = Literal["Leader", "Member"]


class Member(ApiModel):
    id: str
    name: str
    email: str
    role: MemberRole
    title: str
    domain: Domain
    tags: list[str]
    capacity: int
    """每個 Sprint 可承接的 Story Points"""
    github_login: str | None = None
    """GitHub 帳號名稱（GitHub 登入後才有）"""
    avatar_url: str | None = None
    """GitHub 頭像網址"""
    display_name: str | None = None
    """使用者自訂的顯示名稱；為空時 name 為 GitHub 帳號名稱"""


class InviteMemberInput(ApiModel):
    name: str
    email: str
    role: MemberRole
    title: str
    domain: Domain
    tags: list[str]
    capacity: int


class UpdateMemberInput(ApiModel):
    """只傳要修改的欄位"""

    name: str | None = None
    email: str | None = None
    role: MemberRole | None = None
    title: str | None = None
    domain: Domain | None = None
    tags: list[str] | None = None
    capacity: int | None = None


class SwitchUserInput(ApiModel):
    """開發用：切換示範身分（真實登入上線後移除）"""

    member_id: str


class UpdateMeInput(ApiModel):
    """修改自己的帳號設定"""

    display_name: str | None
    """自訂顯示名稱；空字串或 null 表示恢復使用 GitHub 帳號名稱"""
