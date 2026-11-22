"""members：登入的使用者，一個 GitHub 帳號一筆。

規格見 docs/github.md 3.1。專案內的角色、職稱、容量不放這裡，放在 project_members。
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Member(Base):
    __tablename__ = "members"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    auth_user_id: Mapped[uuid.UUID] = mapped_column(Uuid, unique=True)
    """Supabase Auth 的使用者 id（JWT 的 sub）"""
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    """GitHub 使用者 id；帳號改名也不會變，比對以這個為準"""
    github_login: Mapped[str] = mapped_column(Text)
    """GitHub 帳號名稱，系統內的使用者 ID 與預設顯示名稱"""
    display_name: Mapped[str | None] = mapped_column(Text)
    """使用者自訂的顯示名稱；為空時顯示 github_login"""
    email: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # 邀請時用帳號名稱查詢，不分大小寫
        Index("ix_members_github_login_lower", text("lower(github_login)")),
    )
