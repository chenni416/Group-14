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
