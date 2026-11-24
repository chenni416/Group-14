"""知識庫文件 API，對應前端 contracts.ts 的 docs。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts
- frontend/src/mocks/handlers/knowledge.ts

- GitHub 登入的成員：讀寫 documents 資料表（app/services/documents.py）
- 開發用的示範成員（X-Demo-User）：沿用記憶體版假資料（MemoryStore）
- 搜尋還沒有 RAG，兩者都回傳固定的示意結果
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.auth import CurrentMember, require_leader
from app.db.session import get_db
from app.repo import Store
from app.schemas.project import AddLinkBody, KnowledgeDoc, SearchHit, UploadDocsBody
from app.services import documents, projects, workspace_flow

router = APIRouter(tags=["知識庫文件"])

Db = Annotated[Session, Depends(get_db)]
ProjectId = Annotated[str | None, Header(alias="X-Project-Id")]


@router.get("/docs", operation_id="docs.list", summary="專案文件列表", response_model=list[KnowledgeDoc])
def list_docs(me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> list[KnowledgeDoc]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return store.knowledge_docs
    return documents.list_docs(db, projects.require_current_project_id(db, member_id, project_id))


@router.post(
    "/docs",
    operation_id="docs.upload",
    summary="上傳文件（之後改為 multipart 上傳實際檔案）",
    response_model=list[KnowledgeDoc],
)
def upload(
    body: UploadDocsBody, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None
) -> list[KnowledgeDoc]:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return workspace_flow.upload_docs(store, body)
    current = projects.require_current_project_id(db, member_id, project_id)
    return documents.upload_docs(db, current, member_id, body)


@router.post("/docs/links", operation_id="docs.addLink", summary="加入外部連結", response_model=KnowledgeDoc)
def add_link(body: AddLinkBody, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> KnowledgeDoc:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return workspace_flow.add_link(store, body)
    current = projects.require_current_project_id(db, member_id, project_id)
    return documents.add_link(db, current, member_id, body)


@router.delete("/docs/{id}", operation_id="docs.remove", summary="刪除文件", status_code=204)
def remove(id: str, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> None:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        workspace_flow.remove_doc(store, id)
        return
    documents.remove_doc(db, projects.require_current_project_id(db, member_id, project_id), id)


@router.get("/docs/search", operation_id="docs.search", summary="搜尋專案文件", response_model=list[SearchHit])
async def search(q: str) -> list[SearchHit]:
    return workspace_flow.search_docs(q)
