"""sprints：Sprint，包含本次的會議紀錄與 AI 待釐清問題。

對應 frontend/src/types/sprint.ts 的 Sprint。
- 前端的 Sprint.id 是專案內的流水號，對應 number；資料表另有 uuid 主鍵
- 前端顯示用的 start、end（MM/DD）由 start_date、end_date 轉換，不另外存
- 本次文件（Sprint.docs）存在 documents 資料表
- 專案目前進行中、規劃中的 Sprint 由 status 判斷，每個專案各最多一個（部分唯一索引）
"""

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, SmallInteger, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    number: Mapped[int] = mapped_column(Integer)
    """專案內的 Sprint 編號（1、2、3…），對應前端的 Sprint.id"""
    name: Mapped[str] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    goal: Mapped[str] = mapped_column(Text, server_default="")
    status: Mapped[str] = mapped_column(Text, server_default="planning")
    """planning、active、closed"""
    capacity: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    """每位成員本次可承接的點數：{成員 id: 點數}"""
    minutes: Mapped[str] = mapped_column(Text, server_default="")
    """本次會議紀錄全文；AI 拆解引用來源句時以行號對應"""
    clarify_questions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    """AI 從會議紀錄找出的待釐清問題；null 表示尚未分析"""
    planning_step: Mapped[int] = mapped_column(SmallInteger, server_default="1")
    """規劃進度 1～5：上輪統整、設定、Story、Task 與派工、派工總覽與發送"""
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    """結束時的完成統計 {total, done, tasks}；null 表示尚未結束"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('planning', 'active', 'closed')", name="status"),
        CheckConstraint("planning_step BETWEEN 1 AND 5", name="planning_step"),
        CheckConstraint("end_date >= start_date", name="date_range"),
        # 同一個專案內 Sprint 編號不重複
        Index("uq_sprints_project_id_number", "project_id", "number", unique=True),
        # 每個專案最多一個進行中、一個規劃中的 Sprint
        Index("uq_sprints_one_active", "project_id", unique=True, postgresql_where=text("status = 'active'")),
        Index("uq_sprints_one_planning", "project_id", unique=True, postgresql_where=text("status = 'planning'")),
    )
