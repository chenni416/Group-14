"""project_invitations：Leader 用 GitHub 帳號名稱邀請成員。

規格見 docs/github.md 3.4。被邀請的人用 GitHub 登入後，系統比對帳號並讓他接受邀請。
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProjectInvitation(Base):
    __tablename__ = "project_invitations"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    github_login: Mapped[str] = mapped_column(Text, index=True)
    """被邀請的 GitHub 帳號名稱，存小寫（比對時不分大小寫）"""
    github_id: Mapped[int | None] = mapped_column(BigInteger)
    """邀請時若能查到 GitHub id 就一起存，比對更準確"""
    role: Mapped[str] = mapped_column(Text, server_default="Member")
    """加入後的角色"""
    title: Mapped[str] = mapped_column(Text, server_default="")
    """加入後的職稱，可由 Leader 預先填寫"""
    domain: Mapped[str | None] = mapped_column(Text)
    """加入後的領域"""
    capacity: Mapped[int] = mapped_column(Integer, server_default="0")
    """加入後的容量"""
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    """pending、accepted、declined、revoked"""
    invited_by_member_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("members.id"))
    accepted_by_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    """實際接受邀請的人"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """接受、拒絕或撤銷的時間"""

    __table_args__ = (
        CheckConstraint("role IN ('Leader', 'Member')", name="role"),
        CheckConstraint("domain IN ('FE', 'BE', 'AI', 'QA', 'DS')", name="domain"),
        CheckConstraint("status IN ('pending', 'accepted', 'declined', 'revoked')", name="status"),
        # 同一個帳號在同一個專案只能有一筆「待接受」的邀請；已拒絕或撤銷的可以重新邀請
        Index(
            "uq_project_invitations_pending",
            "project_id",
            "github_login",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
    )
