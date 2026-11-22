"""project_members：成員與專案的關係，以及每個專案不同的設定。

規格見 docs/github.md 3.3。前端看到的 Member 由 members + project_members 組成。
每個專案至少要有一位 Leader，由後端在移除成員或變更角色時檢查。
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    member_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str] = mapped_column(Text, server_default="Member")
    """Leader 或 Member"""
    title: Mapped[str] = mapped_column(Text, server_default="")
    """職稱，例如 Backend Engineer"""
    domain: Mapped[str | None] = mapped_column(Text)
    """FE、BE、AI、QA、DS"""
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    """技能標籤"""
    capacity: Mapped[int] = mapped_column(Integer, server_default="0")
    """每個 Sprint 可承接的 Story Points"""
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('Leader', 'Member')", name="role"),
        CheckConstraint("domain IN ('FE', 'BE', 'AI', 'QA', 'DS')", name="domain"),
        CheckConstraint("capacity >= 0", name="capacity"),
    )
