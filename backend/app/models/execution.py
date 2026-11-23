"""任務執行：執行計畫與 Living Prompt。

對應 app/repo/memory.py 的 plans、threads，以及 app/schemas/collab.py 的 ExecutionPlan、PromptState、ChatMessage。
每個任務最多一份執行計畫、一份 Living Prompt（主鍵就是 task_id）。
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ExecutionPlan(Base):
    """execution_plans：成員的執行計畫（AI 建議後由成員調整、確認）"""

    __tablename__ = "execution_plans"

    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    checklist: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    """執行步驟 [{id, text, done, acIndex, dueAt}]"""
    checkpoints: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    """階段檢查點 [{id, title, dueAt, reachedAt}]"""
    dep_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    """前置條件檢查 [{id, text, met, source}]"""
    origin: Mapped[str] = mapped_column(Text, server_default="ai")
    """ai（AI 建議）或 human（成員自己建立）"""
    edited: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """成員是否調整過 AI 建議"""
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """成員確認計畫、開始執行的時間；為空表示尚未確認"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (CheckConstraint("origin IN ('ai', 'human')", name="origin"),)


class PromptThread(Base):
    """prompt_threads：任務的 Living Prompt 版本紀錄

    每個版本的完整 Prompt 由「任務規格 + 該版本累積的釐清結論」組成，不另外存。
    """

    __tablename__ = "prompt_threads"

    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    clarifications: Mapped[list[list[str]]] = mapped_column(JSONB, server_default=text("'[[]]'::jsonb"))
    """每個版本累積的釐清結論；第 0 版為空（只有任務規格）"""
    cursor: Mapped[int] = mapped_column(Integer, server_default="0")
    """目前選取的版本（從 0 開始）"""
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (CheckConstraint("cursor >= 0", name="cursor"),)


class TaskChatMessage(Base):
    """task_chat_messages：Prompt Studio 裡與專案脈絡助理的對話"""

    __tablename__ = "task_chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(Text)
    """user（成員）或 assistant（AI）"""
    text: Mapped[str] = mapped_column(Text)
    sources: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    """AI 回答引用的文件"""
    prompt_addition: Mapped[str | None] = mapped_column(Text)
    """這次回答加進 Prompt 的釐清結論"""
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    """加入後的 Prompt 版本"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="role"),
        # 依任務列出對話（舊的在前）
        Index("ix_task_chat_messages_task_id_created_at", "task_id", "created_at"),
    )
