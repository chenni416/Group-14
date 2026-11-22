"""github_commits：預設 branch 最近 commit 的快取。

規格見 docs/github.md 3.7（建議）。顯示專案最近動態用，只保留最近一段時間（例如 90 天或最近 500 筆）。
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GithubCommit(Base):
    __tablename__ = "github_commits"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    repo_id: Mapped[int] = mapped_column(BigInteger)
    sha: Mapped[str] = mapped_column(Text)
    """commit SHA"""
    branch: Mapped[str] = mapped_column(Text)
    """讀取時所在的 branch（預設 branch）"""
    message: Mapped[str] = mapped_column(Text)
    """commit 訊息第一行"""
    author_login: Mapped[str | None] = mapped_column(Text)
    """GitHub 帳號；作者沒有綁定 GitHub 時為空"""
    author_name: Mapped[str] = mapped_column(Text)
    """git 設定的作者名稱"""
    author_github_id: Mapped[int | None] = mapped_column(BigInteger)
    """對應 members.github_id"""
    url: Mapped[str] = mapped_column(Text)
    pull_request_number: Mapped[int | None] = mapped_column(Integer)
    """由 PR 合併產生時記錄"""
    task_code: Mapped[str | None] = mapped_column(Text)
    """從 commit 訊息或所屬 PR 解析的任務編號"""
    committed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("repo_id", "sha", name="uq_github_commits_repo_id_sha"),
        # 依專案列出最近的 commit（新的在前）
        Index("ix_github_commits_project_id_committed_at", "project_id", text("committed_at DESC")),
    )
