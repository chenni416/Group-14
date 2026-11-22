"""github_pull_requests：PR 狀態快照。

規格見 docs/github.md 3.6。同步時以 github_id 為準寫入或更新，畫面顯示進度時讀這張表，不用每次呼叫 GitHub。
對應前端 Task.pr（frontend/src/types/task.ts 的 PullRequest）。
task_id 的外鍵等 tasks 資料表建立後再加。
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GithubPullRequest(Base):
    __tablename__ = "github_pull_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"))
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    """GitHub 的 PR id"""
    repo_id: Mapped[int] = mapped_column(BigInteger)
    """所屬 repo 的 GitHub id"""
    number: Mapped[int] = mapped_column(Integer)
    """PR 編號，例如 #33"""
    title: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    author_login: Mapped[str] = mapped_column(Text)
    """開 PR 的人"""
    author_github_id: Mapped[int | None] = mapped_column(BigInteger)
    """用來對應 members.github_id"""
    head_branch: Mapped[str] = mapped_column(Text)
    """來源 branch，例如 feat/S221-planning-split"""
    base_branch: Mapped[str] = mapped_column(Text)
    """目標 branch，例如 main"""
    head_sha: Mapped[str] = mapped_column(Text)
    """最新 commit，用來查 CI 結果"""
    state: Mapped[str] = mapped_column(Text)
    """open、closed、merged"""
    draft: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    review_state: Mapped[str] = mapped_column(Text, server_default="none")
    """none、approved、changes_requested、commented"""
    requested_reviewers: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default=text("'{}'"))
    """被要求審查的 GitHub 帳號"""
    checks_state: Mapped[str] = mapped_column(Text, server_default="none")
    """CI 結果：none、pending、passed、failed（對應前端 PullRequest.tests）"""
    changed_files: Mapped[int] = mapped_column(Integer, server_default="0")
    additions: Mapped[int] = mapped_column(Integer, server_default="0")
    deletions: Mapped[int] = mapped_column(Integer, server_default="0")
    task_code: Mapped[str | None] = mapped_column(Text)
    """從 head_branch 解析出的任務編號，例如 S-221；解析不到時為空"""
    task_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    """對應的任務；tasks 資料表建立後加上外鍵（ON DELETE SET NULL）"""
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    merged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    merged_by_login: Mapped[str | None] = mapped_column(Text)
    """按下合併的 GitHub 帳號"""
    merged_by_github_id: Mapped[int | None] = mapped_column(BigInteger)
    merge_commit_sha: Mapped[str | None] = mapped_column(Text)
    completed_task: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """這個 PR 的合併是否觸發了任務自動完成；避免同一事件重複處理"""
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    github_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    """GitHub 上的最後更新時間，用來判斷要不要更新"""
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    """最後一次寫入這筆資料的時間"""

    __table_args__ = (
        UniqueConstraint("repo_id", "number", name="uq_github_pull_requests_repo_id_number"),
        CheckConstraint("state IN ('open', 'closed', 'merged')", name="state"),
        CheckConstraint("review_state IN ('none', 'approved', 'changes_requested', 'commented')", name="review_state"),
        CheckConstraint("checks_state IN ('none', 'pending', 'passed', 'failed')", name="checks_state"),
        # 畫面依狀態分類
        Index("ix_github_pull_requests_project_id_state", "project_id", "state"),
        # 依任務查詢 PR
        Index("ix_github_pull_requests_project_id_task_code", "project_id", "task_code"),
    )
