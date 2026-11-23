"""github_webhook_events：GitHub webhook 的原始事件。

規格見 docs/github.md 3.8。每次通知先寫入這張表再處理：用 delivery_id 避免重複處理，也方便除錯與重新處理。
部署後啟用 webhook 時才會使用；保留 30 天，之後由排程刪除。
"""

from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Index, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GithubWebhookEvent(Base):
    __tablename__ = "github_webhook_events"

    delivery_id: Mapped[str] = mapped_column(Text, primary_key=True)
    """X-GitHub-Delivery 標頭"""
    event: Mapped[str] = mapped_column(Text)
    """X-GitHub-Event，例如 pull_request"""
    action: Mapped[str | None] = mapped_column(Text)
    """payload 的 action，例如 opened、closed"""
    installation_id: Mapped[int | None] = mapped_column(BigInteger)
    repo_id: Mapped[int | None] = mapped_column(BigInteger)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    """完整內容"""
    status: Mapped[str] = mapped_column(Text, server_default="received")
    """received、processed、ignored、failed"""
    error: Mapped[str | None] = mapped_column(Text)
    """處理失敗的原因"""
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('received', 'processed', 'ignored', 'failed')", name="status"),
        Index("ix_github_webhook_events_status_received_at", "status", "received_at"),
    )
