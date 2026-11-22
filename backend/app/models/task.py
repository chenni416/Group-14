"""tasks：任務，包含規劃草稿（AI_DRAFT、DRAFT）與正式任務。

對應 frontend/src/types/task.ts 的 Task，以及 docs/github.md 3.9。
- AI 拆解的結果直接存成任務，狀態為 AI_DRAFT；Leader 調整後為 DRAFT；核准送出後進入正式流程
- 前端的 Task.id 是任務編號（例如 S-321），對應 code；資料表另有 uuid 主鍵
- Story 的編號與標題存在 epic，使用者故事存在 story
- 前端的 Task.pr 由這個任務最新的一筆 github_pull_requests 組成，不另外存
- 前置任務存在 task_dependencies
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

TASK_STATES = (
    "AI_DRAFT",
    "DRAFT",
    "PENDING_MEMBER",
    "RETURNED",
    "ASSIGNED",
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "DEFERRED",
)
_STATE_LIST = ", ".join(f"'{s}'" for s in TASK_STATES)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    sprint_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(Text)
    """任務編號，例如 S-321（Sprint 3、Story 2、Task 1）；專案內唯一，對應前端的 Task.id"""

    # ---------- 內容 ----------
    title: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, server_default="")
    """AI 技術分析或任務說明"""
    domain: Mapped[str] = mapped_column(Text)
    """FE、BE、AI、QA、DS"""
    tags: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    story_points: Mapped[int] = mapped_column(Integer)
    """目前前端與後端限制為 1、2、3、5、8；資料庫只檢查大於 0，規則改變時不用改資料表"""
    story_points_reason: Mapped[str] = mapped_column(Text, server_default="")
    acceptance_criteria: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    epic: Mapped[str] = mapped_column(Text, server_default="")
    """所屬 Story 的編號與標題，例如 S3-1 會議紀錄匯入"""
    story: Mapped[str] = mapped_column(Text, server_default="")
    """使用者故事描述"""
    source: Mapped[str] = mapped_column(Text, server_default="")
    """來源句：任務來自會議紀錄的哪一句"""
    scope: Mapped[str] = mapped_column(Text, server_default="")
    out_of_scope: Mapped[str] = mapped_column(Text, server_default="")
    responsibility: Mapped[str] = mapped_column(Text, server_default="")
    deliverables: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    """預期交付成果"""
    branch: Mapped[str] = mapped_column(Text, server_default="")
    """branch 名稱，例如 feat/S321-planning-split"""

    # ---------- 規劃 ----------
    origin: Mapped[str] = mapped_column(Text, server_default="human")
    """ai（AI 拆解）或 human（手動建立）"""
    edited: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """Leader 是否調整過 AI 建議；重新拆解時保留調整過的任務"""
    clarified: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """驗收條件已套用待釐清問題的回答"""
    state: Mapped[str] = mapped_column(Text, server_default="AI_DRAFT")
    prev_state: Mapped[str | None] = mapped_column(Text)
    """延後前的狀態，用來恢復"""

    # ---------- 指派 ----------
    assignee_member_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="SET NULL"), index=True
    )
    """負責人；為空表示尚未指派（前端以空字串表示）"""
    suggested_assignee_member_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="SET NULL")
    )
    """AI 建議的負責人"""
    suggest_reason: Mapped[str] = mapped_column(Text, server_default="")
    negotiation: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    """成員協商退回的內容 {byId, reason, suggestId, target}；沒有協商時為空"""
    return_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    """協商退回當下的內容，用來列出 Leader 修改了哪些地方"""

    # ---------- 審查 ----------
    policy: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("""'{"mode": "pool", "targets": [], "rule": "any"}'::jsonb""")
    )
    """Review 策略，格式同前端 ReviewPolicy"""
    policy_reason: Mapped[str] = mapped_column(Text, server_default="")
    reviewer_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    """認領審查的人"""
    approvals: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(Uuid), server_default=text("'{}'"))
    """已同意的審查者（成員 id）"""
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    review_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    """成員送審時提交的交付內容；尚未送審時為空"""

    # ---------- 延續到下一輪 ----------
    carry_tag: Mapped[str | None] = mapped_column(Text)
    """由延續事項帶入：deferred（延後）、multi（跨 Sprint）"""
    multi_sprint: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """需要延續一個 Sprint 以上"""
    carry: Mapped[bool | None] = mapped_column(Boolean)
    """上輪未完成任務的決定：true 帶入下一個 Sprint、false 延後、空值尚未決定"""
    carry_assignee_member_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="SET NULL")
    )
    """帶入時改派的負責人；為空表示維持原負責人"""
    carry_points: Mapped[int | None] = mapped_column(Integer)
    """Leader 重新評估的剩餘點數；為空表示沿用原點數"""
    carry_status: Mapped[str | None] = mapped_column(Text)
    """成員對帶入或延後決定的確認：pending、accepted、returned"""
    plan_confirms: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    """成員對延後或調整的回覆 [{memberId, status, note, at}]"""

    # ---------- 完成（docs/github.md 3.9） ----------
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completion_source: Mapped[str | None] = mapped_column(Text)
    """review（系統內審查通過）或 github_merge（PR 合併自動完成）"""
    completed_by_pull_request_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("github_pull_requests.id", ondelete="SET NULL")
    )
    """自動完成時是哪個 PR 觸發的"""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("uq_tasks_project_id_code", "project_id", "code", unique=True),
        Index("ix_tasks_sprint_id_state", "sprint_id", "state"),
        CheckConstraint(f"state IN ({_STATE_LIST})", name="state"),
        CheckConstraint(f"prev_state IN ({_STATE_LIST})", name="prev_state"),
        CheckConstraint("domain IN ('FE', 'BE', 'AI', 'QA', 'DS')", name="domain"),
        CheckConstraint("story_points > 0", name="story_points"),
        CheckConstraint("carry_points >= 0", name="carry_points"),
        CheckConstraint("origin IN ('ai', 'human')", name="origin"),
        CheckConstraint("carry_tag IN ('deferred', 'multi')", name="carry_tag"),
        CheckConstraint("carry_status IN ('pending', 'accepted', 'returned')", name="carry_status"),
        CheckConstraint("completion_source IN ('review', 'github_merge')", name="completion_source"),
    )


class TaskDependency(Base):
    """task_dependencies：前置任務（task 要等 depends_on_task 完成）。可以依賴上一個 Sprint 的任務"""

    __tablename__ = "task_dependencies"

    task_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True)
    depends_on_task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    reason: Mapped[str] = mapped_column(Text, server_default="")
    """為什麼需要先完成"""

    __table_args__ = (CheckConstraint("task_id <> depends_on_task_id", name="not_self"),)
