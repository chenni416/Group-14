"""documents：專案知識庫與 Sprint 會議文件。

對應前端 KnowledgeDoc（frontend/src/types/project.ts）與 SprintDoc（sprint.ts）。
- sprint_id 為空：專案知識庫文件（PRD、架構圖、Coding Standards…）
- sprint_id 有值：該 Sprint 的會議文件
- 檔案本身存在 Supabase Storage，這裡只存位置與資訊；外部連結（例如 Figma）存 url
- 前端顯示的 size（例如 38 KB）由 size_bytes 轉換
"""

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=func.gen_random_uuid())
    project_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    sprint_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("sprints.id", ondelete="CASCADE"), index=True)
    """所屬的 Sprint；為空表示專案知識庫文件"""
    name: Mapped[str] = mapped_column(Text)
    """檔名或連結名稱，例如 PRD_v2.md"""
    kind: Mapped[str] = mapped_column(Text, server_default="")
    """文件類型，例如 PRD、Figma、README"""
    is_link: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    """外部連結（不是上傳的檔案）"""
    storage_path: Mapped[str | None] = mapped_column(Text, unique=True)
    """檔案在 Supabase Storage 的路徑；連結為空"""
    url: Mapped[str | None] = mapped_column(Text)
    """外部連結網址；檔案為空"""
    content_type: Mapped[str | None] = mapped_column(Text)
    """檔案格式，例如 text/markdown、application/pdf"""
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    """檔案大小（bytes）；連結為空"""
    extracted_text: Mapped[str | None] = mapped_column(Text)
    """從檔案擷取的純文字，給 AI 組裝脈絡與搜尋使用；尚未處理時為空"""
    index_progress: Mapped[int] = mapped_column(Integer, server_default="0")
    """處理進度 0～100"""
    chunk_count: Mapped[int] = mapped_column(Integer, server_default="0")
    """切分的段落數"""
    uploaded_by_member_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("members.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("index_progress BETWEEN 0 AND 100", name="index_progress"),
        CheckConstraint("chunk_count >= 0", name="chunk_count"),
        # 連結一定要有網址，檔案一定要有存放位置
        CheckConstraint("(is_link AND url IS NOT NULL) OR (NOT is_link AND storage_path IS NOT NULL)", name="source"),
    )
