"""知識庫文件：documents 資料表的讀寫（GitHub 登入的成員使用）。

- 專案知識庫的文件 sprint_id 為空；Sprint 的會議文件之後再接
- 目前前端只送出檔名與大小，還沒有上傳檔案內容：storage_path 先記錄預定的存放位置，
  之後接上 Supabase Storage 時，把檔案上傳到這個位置
- 還沒有 RAG 索引：上傳後直接視為處理完成，chunk_count 為 0
"""

import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Document as DocumentRow
from app.schemas.project import AddLinkBody, KnowledgeDoc, UploadDocsBody
from app.services.workspace_flow import format_size, guess_doc_kind

NAME_MAX = 200


def list_docs(db: Session, project_id: uuid.UUID) -> list[KnowledgeDoc]:
    """專案知識庫的文件，先加入的在前"""
    rows = db.scalars(
        select(DocumentRow)
        .where(DocumentRow.project_id == project_id, DocumentRow.sprint_id.is_(None))
        .order_by(DocumentRow.created_at)
    ).all()
    return [to_schema(row) for row in rows]


def upload_docs(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, body: UploadDocsBody) -> list[KnowledgeDoc]:
    rows: list[DocumentRow] = []
    for f in body.files:
        name = f.name.strip()[:NAME_MAX]
        if not name:
            raise ApiError("檔名不能是空的", status=422, code="VALIDATION_ERROR")
        doc_id = uuid.uuid4()
        rows.append(
            DocumentRow(
                id=doc_id,
                project_id=project_id,
                name=name,
                kind=guess_doc_kind(name),
                is_link=False,
                storage_path=f"{project_id}/{doc_id}/{name}",
                size_bytes=max(0, f.size),
                index_progress=100,
                uploaded_by_member_id=member_id,
            )
        )
    db.add_all(rows)
    db.commit()
    return [to_schema(row) for row in rows]


def add_link(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, body: AddLinkBody) -> KnowledgeDoc:
    url = body.url.strip()
    if not re.match(r"^https?://", url, re.IGNORECASE):
        raise ApiError("請輸入以 http:// 或 https:// 開頭的網址", status=422, code="VALIDATION_ERROR")
    if re.search("figma", url, re.IGNORECASE):
        kind = "Figma"
    elif re.search("notion", url, re.IGNORECASE):
        kind = "Notion"
    elif re.search("github", url, re.IGNORECASE):
        kind = "README"
    else:
        kind = "連結"
    row = DocumentRow(
        project_id=project_id,
        name=re.sub(r"^https?://", "", url)[:40],
        kind=kind,
        is_link=True,
        url=url,
        index_progress=100,
        uploaded_by_member_id=member_id,
    )
    db.add(row)
    db.commit()
    return to_schema(row)


def remove_doc(db: Session, project_id: uuid.UUID, doc_id: str) -> None:
    """刪除知識庫文件；不是這個專案的文件時回傳 404"""
    try:
        target = uuid.UUID(doc_id)
    except ValueError:
        target = None
    row = db.get(DocumentRow, target) if target else None
    if row is None or row.project_id != project_id or row.sprint_id is not None:
        raise ApiError("找不到這份文件", status=404, code="NOT_FOUND")
    db.delete(row)
    db.commit()


def to_schema(row: DocumentRow) -> KnowledgeDoc:
    return KnowledgeDoc(
        id=str(row.id),
        name=row.name,
        kind=row.kind,
        size="連結" if row.is_link else format_size(row.size_bytes or 0),
        progress=row.index_progress,
        chunks=row.chunk_count,
        is_link=row.is_link,
    )
