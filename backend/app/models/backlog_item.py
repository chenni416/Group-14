"""backlog_items：延續事項，延後或跨 Sprint、要帶到之後規劃的問題。

對應 frontend/src/types/sprint.ts 的 BacklogItem。
在「上輪 Sprint 統整」時由 Leader 決定處理方式；選擇「納入本輪」的項目會寫進本次會議紀錄。
- 前端的 fromSprint（顯示用名稱）由 from_sprint_id 查出
- task_id 的外鍵等 tasks 資料表建立後再加
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class BacklogItem(Base):
    __tablename__ = "backlog_items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    """事項內容"""
    kind: Mapped[str] = mapped_column(Text)
    """deferred（延後）或 multi（需要延續一個 Sprint 以上）"""
    from_sprint_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="SET NULL"))
    """從哪個 Sprint 延續過來"""
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    """相關的任務；tasks 資料表建立後加上外鍵（ON DELETE SET NULL）"""
    used_in_sprint_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="SET NULL"))
    """已寫入哪個 Sprint 的會議紀錄；為空表示尚未帶入"""
    decision: Mapped[str | None] = mapped_column(Text)
    """本次規劃的處理方式：include（納入本輪）、keep（繼續保留）、remove（移除）；為空表示尚未決定"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("kind IN ('deferred', 'multi')", name="kind"),
        CheckConstraint("decision IN ('include', 'keep', 'remove')", name="decision"),
    )
