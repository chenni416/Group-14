"""github_installations：GitHub App 安裝紀錄。

規格見 docs/github.md 3.5。一個安裝可以授權多個 repo，也可以被多個專案使用。
不存 installation token（一小時就過期，由後端隨時換新）與已授權的 repo 清單（需要時即時查詢）。
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GithubInstallation(Base):
    __tablename__ = "github_installations"

    installation_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    """GitHub 提供的安裝 id（不是資料庫自動編號）"""
    account_id: Mapped[int] = mapped_column(BigInteger, index=True)
    """安裝到的 GitHub 帳號或組織 id"""
    account_login: Mapped[str] = mapped_column(Text)
    """帳號或組織名稱，例如 chenni416"""
    account_type: Mapped[str] = mapped_column(Text)
    """User 或 Organization"""
    account_avatar_url: Mapped[str | None] = mapped_column(Text)
    repository_selection: Mapped[str] = mapped_column(Text)
    """all（全部 repo）或 selected（指定 repo）"""
    status: Mapped[str] = mapped_column(Text, server_default="active")
    """active、suspended、deleted"""
    installed_by_member_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("members.id", ondelete="SET NULL")
    )
    """誰安裝的；透過核准請求安裝時可能不是系統內的成員"""
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    """App 被移除時記錄，不刪除資料列"""
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("account_type IN ('User', 'Organization')", name="account_type"),
        CheckConstraint("repository_selection IN ('all', 'selected')", name="repository_selection"),
        CheckConstraint("status IN ('active', 'suspended', 'deleted')", name="status"),
    )
