"""知識庫文件 API，對應前端 contracts.ts 的 docs。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts
- frontend/src/mocks/handlers/knowledge.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.auth import CurrentMember, require_leader
from app.repo import Store
from app.schemas.project import AddLinkBody, KnowledgeDoc, SearchHit, UploadDocsBody
from app.services import workspace_flow

router = APIRouter(tags=["知識庫文件"])


@router.get("/docs", operation_id="docs.list", summary="專案文件列表", response_model=list[KnowledgeDoc])
async def list_docs(store: Store) -> list[KnowledgeDoc]:
    return store.knowledge_docs


@router.post(
    "/docs",
    operation_id="docs.upload",
    summary="上傳文件（之後改為 multipart 上傳實際檔案）",
    response_model=list[KnowledgeDoc],
)
async def upload(body: UploadDocsBody, store: Store, me: CurrentMember) -> list[KnowledgeDoc]:
    require_leader(me)
    return workspace_flow.upload_docs(store, body)


@router.post("/docs/links", operation_id="docs.addLink", summary="加入外部連結", response_model=KnowledgeDoc)
async def add_link(body: AddLinkBody, store: Store, me: CurrentMember) -> KnowledgeDoc:
    require_leader(me)
    return workspace_flow.add_link(store, body)


@router.delete("/docs/{id}", operation_id="docs.remove", summary="刪除文件", status_code=204)
async def remove(id: str, store: Store, me: CurrentMember) -> None:
    require_leader(me)
    workspace_flow.remove_doc(store, id)


@router.get("/docs/search", operation_id="docs.search", summary="搜尋專案文件", response_model=list[SearchHit])
async def search(q: str) -> list[SearchHit]:
    return workspace_flow.search_docs(q)
