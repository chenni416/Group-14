"""驗收與回顧：驗收紀錄、Sprint 回顧與改善行動。

對應 app/schemas/acceptance.py 的 AcceptanceRecord，以及 app/schemas/collab.py 的 Retro、RetroEntry、RetroAction。
- AI 驗收檢查（AcceptanceCheck）每次即時產生，不另外存；Reviewer 的最終判斷存在 acceptance_records
- 成員送審的交付內容存在 tasks.delivery
- 前端的 Retro.sprintId、RetroAction.fromSprintId 是 Sprint 編號，由 sprints.number 轉換
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, UniqueConstraint, Uuid, func
from sqlalchemy import text as sql_text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AcceptanceRecord(Base):
    """acceptance_records：Reviewer 的驗收決定（通過或退回修改），一次審查一筆"""

    __tablename__ = "acceptance_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"))
    items: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=sql_text("'[]'::jsonb"))
    """逐條驗收條件的判斷 [{ac, ai, evidence, reviewer, note}]"""
    decision: Mapped[str] = mapped_column(Text)
    """approved（通過）或 changes（退回修改）"""
    reason: Mapped[str] = mapped_column(Text, server_default="")
    reviewer_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("decision IN ('approved', 'changes')", name="decision"),
        # 依任務列出驗收紀錄（舊的在前）
        Index("ix_acceptance_records_task_id_created_at", "task_id", "created_at"),
    )


class Retro(Base):
    """retros：Sprint 回顧，每個 Sprint 一份"""

    __tablename__ = "retros"

    sprint_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(Text, server_default="open")
    """open（填寫中）或 closed（已結束）"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (CheckConstraint("status IN ('open', 'closed')", name="status"),)


class RetroEntry(Base):
    """retro_entries：每位成員的回顧內容，一個 Sprint 每人一筆"""

    __tablename__ = "retro_entries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    sprint_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("retros.sprint_id", ondelete="CASCADE"))
    author_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    well: Mapped[str] = mapped_column(Text, server_default="")
    """做得好的地方"""
    hard: Mapped[str] = mapped_column(Text, server_default="")
    """遇到的困難"""
    improve: Mapped[str] = mapped_column(Text, server_default="")
    """下次可以改進的地方"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("sprint_id", "author_member_id", name="uq_retro_entries_sprint_id_author_member_id"),
    )


class RetroAction(Base):
    """retro_actions：回顧訂出的改善行動，可以帶到下一個 Sprint 追蹤"""

    __tablename__ = "retro_actions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    from_sprint_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("retros.sprint_id", ondelete="CASCADE"), index=True
    )
    """在哪個 Sprint 的回顧訂出"""
    text: Mapped[str] = mapped_column(Text)
    owner_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    """負責人"""
    done: Mapped[bool] = mapped_column(Boolean, server_default=sql_text("false"))
    used_in_sprint_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="SET NULL"))
    """已帶入哪個 Sprint 追蹤；為空表示尚未帶入"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
