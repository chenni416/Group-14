"""projects：專案，包含綁定的 GitHub repo。

GitHub 欄位規格見 docs/github.md 3.2；其他欄位對應 frontend/src/types/project.ts。
- 前端的 Project.repo 對應 github_repo_full_name；Project.provider 目前固定為 GitHub，不另外存
- activeSprintId、planningSprintId 等 sprints 資料表建立後再加
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(Text)
    goal: Mapped[str] = mapped_column(Text, server_default="")
    """專案整體目標"""
    prefix: Mapped[str] = mapped_column(Text)
    """專案代碼，例如 TL"""
    branch_pattern: Mapped[str] = mapped_column(Text, server_default="")
    """branch 命名規則"""
    sprint_length: Mapped[str] = mapped_column(Text, server_default="2 週")
    default_policy: Mapped[dict[str, Any]] = mapped_column(
        JSONB, server_default=text("""'{"mode": "pool", "targets": [], "rule": "any"}'::jsonb""")
    )
    """專案預設的 Review 策略，格式同前端 ReviewPolicy"""
    created_by_member_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("members.id"))
    """建立專案的人"""

    # ---------- GitHub repo 連結 ----------
    github_link_status: Mapped[str] = mapped_column(Text, server_default="none")
    """none、pending、linked、revoked"""
    github_installation_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("github_installations.installation_id", ondelete="SET NULL"), index=True
    )
    github_repo_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    """GitHub repo id，改名或轉移都不會變；一個 repo 只能綁一個專案"""
    github_repo_full_name: Mapped[str | None] = mapped_column(Text)
    """owner/name，例如 chenni416/Group-14"""
    github_repo_url: Mapped[str | None] = mapped_column(Text)
    github_default_branch: Mapped[str | None] = mapped_column(Text)
    github_repo_private: Mapped[bool | None] = mapped_column(Boolean)
    github_linked_by_member_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="SET NULL")
    )
    github_linked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    github_last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """最後一次成功同步 PR 的時間"""
    github_sync_error: Mapped[str | None] = mapped_column(Text)
    """最後一次同步失敗的原因，成功時清空"""

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("github_link_status IN ('none', 'pending', 'linked', 'revoked')", name="github_link_status"),
    )
