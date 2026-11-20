"""提案 API，對應前端 contracts.ts 的 proposals。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.collab import CreateProposalInput, DecideProposalInput, Proposal, TextBody

router = APIRouter(tags=["提案"])


@router.get("/proposals", operation_id="proposals.list", summary="提案列表", response_model=list[Proposal])
async def list_proposals() -> list[Proposal]:
    raise not_implemented("proposals.list")


@router.post("/proposals", operation_id="proposals.create", summary="新增提案（通知 Leader）", response_model=Proposal)
async def create(body: CreateProposalInput) -> Proposal:
    raise not_implemented("proposals.create")


@router.post("/proposals/{id}/comments", operation_id="proposals.comment", summary="提案留言", response_model=Proposal)
async def comment(id: str, body: TextBody) -> Proposal:
    raise not_implemented("proposals.comment")


@router.post("/proposals/{id}/decide", operation_id="proposals.decide", summary="Leader 決策", response_model=Proposal)
async def decide(id: str, body: DecideProposalInput) -> Proposal:
    raise not_implemented("proposals.decide")
