"""協作：任務留言、問題回報、提案與通知。

對應 app/schemas/collab.py 的 TaskComment、Issue、Proposal、Notification（API 已定義，目前回傳 501）。
- 前端的 Issue.sprintId、Proposal.sprintId 是 Sprint 編號，由 sprints.number 轉換
- 留言者、回報者等紀錄類欄位在成員刪除時設為空，內容保留
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, Uuid, func
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _member_fk() -> ForeignKey:
    """指向成員的紀錄類外鍵：成員刪除時設為空"""
    return ForeignKey("members.id", ondelete="SET NULL")


class TaskComment(Base):
    """task_comments：任務留言區"""

    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"))
    author_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    text: Mapped[str] = mapped_column(Text)
    mentions: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(Uuid), server_default=sql_text("'{}'"))
    """被 @ 標注的成員"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (Index("ix_task_comments_task_id_created_at", "task_id", "created_at"),)


class Issue(Base):
    """issues：問題回報（Blocker），系統推薦處理人並通知"""

    __tablename__ = "issues"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    """遇到問題的任務；所屬 Sprint 由任務查出"""
    type: Mapped[str] = mapped_column(Text)
    """tech（技術）、dependency（相依）、schedule（時程）、other"""
    description: Mapped[str] = mapped_column(Text)
    reporter_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    owner_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk(), index=True)
    """處理人"""
    suggested_owner_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    """系統推薦的處理人"""
    owner_reason: Mapped[str] = mapped_column(Text, server_default="")
    """推薦理由"""
    status: Mapped[str] = mapped_column(Text, server_default="reported")
    """reported、assigned、responded、resolved、replan"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("type IN ('tech', 'dependency', 'schedule', 'other')", name="type"),
        CheckConstraint("status IN ('reported', 'assigned', 'responded', 'resolved', 'replan')", name="status"),
    )


class IssueResponse(Base):
    """issue_responses：問題的回應"""

    __tablename__ = "issue_responses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    issue_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    author_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Proposal(Base):
    """proposals：Idea 與改善提案，由 Leader 決定採用、延後或不採用"""

    __tablename__ = "proposals"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    sprint_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="SET NULL"))
    """相關的任務；可以沒有"""
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default="")
    kind: Mapped[str] = mapped_column(Text)
    """idea（新想法）、improve（改善）、change（變更）"""
    author_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    status: Mapped[str] = mapped_column(Text, server_default="open")
    """open（討論中）、adopted（採用）、rejected（不採用）、nextSprint（延到下個 Sprint）"""
    decision: Mapped[str] = mapped_column(Text, server_default="")
    """Leader 的決定理由"""
    decided_by_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("kind IN ('idea', 'improve', 'change')", name="kind"),
        CheckConstraint("status IN ('open', 'adopted', 'rejected', 'nextSprint')", name="status"),
    )


class ProposalComment(Base):
    """proposal_comments：提案的討論"""

    __tablename__ = "proposal_comments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    proposal_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("proposals.id", ondelete="CASCADE"), index=True)
    author_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


NOTIFICATION_TYPES = ("invite", "review", "pool", "returned", "info", "issue", "proposal", "plan", "mention")


class Notification(Base):
    """notifications：通知

    ref_id 依 type 指向不同的資料（例如 issue 的 id、proposal 的 id），所以不建外鍵。
    """

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    recipient_member_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("members.id", ondelete="CASCADE"))
    """收到通知的人"""
    sender_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, _member_fk())
    """觸發通知的人"""
    type: Mapped[str] = mapped_column(Text)
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"))
    """相關的任務；提案可以沒有（前端以空字串表示）"""
    ref_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    """相關的問題回報或提案"""
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, server_default="pending")
    """pending（待處理）、done（已處理）"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(f"type IN ({', '.join(repr(t) for t in NOTIFICATION_TYPES)})", name="type"),
        CheckConstraint("status IN ('pending', 'done')", name="status"),
        # 列出某人的待處理通知（新的在前）
        Index("ix_notifications_recipient_status_created_at", "recipient_member_id", "status", "created_at"),
    )
