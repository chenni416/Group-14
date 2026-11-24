"""邀請碼加入：project_join_codes、project_join_requests。

流程：Leader 產生專案的邀請碼（例如 TL-7K2QX9）→ 任何人登入後輸入邀請碼、送出加入申請
→ Leader 在團隊頁同意後才加入專案，也可以拒絕。規格見 docs/github.md 第 7.2 節。
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProjectJoinCode(Base):
    """project_join_codes：專案邀請碼。同一個專案同時只有一組有效的邀請碼，產生新碼時停用舊碼"""

    __tablename__ = "project_join_codes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(Text, unique=True)
    """邀請碼，存大寫；比對時不分大小寫"""
    role: Mapped[str] = mapped_column(Text, server_default="Member")
    """經同意加入後的角色"""
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """為空表示不會過期"""
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """停用時間；停用後不能再申請"""
    created_by_member_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("members.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (CheckConstraint("role IN ('Leader', 'Member')", name="role"),)


class ProjectJoinRequest(Base):
    """project_join_requests：用邀請碼送出的加入申請，等待 Leader 同意"""

    __tablename__ = "project_join_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    join_code_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("project_join_codes.id", ondelete="SET NULL")
    )
    """用哪組邀請碼申請的"""
    member_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("members.id", ondelete="CASCADE"))
    """申請的人"""
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    """pending、approved、rejected、cancelled"""
    decided_by_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    """同意或拒絕的 Leader"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected', 'cancelled')", name="status"),
        # 同一個人對同一個專案只能有一筆待審核的申請
        Index(
            "uq_project_join_requests_pending",
            "project_id",
            "member_id",
            unique=True,
            postgresql_where=text("status = 'pending'"),
        ),
        # Leader 列出待審核的申請
        Index("ix_project_join_requests_project_id_status", "project_id", "status"),
    )
