"""提案 API，對應前端 contracts.ts 的 proposals。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/collab.ts

各端點是否已實作、資料來源（資料庫或記憶體）與是否需要登入，見 docs/api-status.md（由 scripts/route_status.py 產生）。
"""

from fastapi import APIRouter

from app.api.deps import Db, ProjectId
from app.core.auth import CurrentMember
from app.core.errors import not_implemented
from app.schemas.collab import CreateProposalInput, DecideProposalInput, Proposal, TextBody
from app.services import collab, projects

router = APIRouter(tags=["提案"])


@router.get("/proposals", operation_id="proposals.list", summary="提案列表", response_model=list[Proposal])
def list_proposals(me: CurrentMember, db: Db, project_id: ProjectId = None) -> list[Proposal]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:  # 示範成員（X-Demo-User）沒有提案資料
        return []
    return collab.list_proposals(db, projects.require_current_project_id(db, member_id, project_id))


@router.post("/proposals", operation_id="proposals.create", summary="新增提案（通知 Leader）", response_model=Proposal)
async def create(body: CreateProposalInput) -> Proposal:
    raise not_implemented("proposals.create")


@router.post("/proposals/{id}/comments", operation_id="proposals.comment", summary="提案留言", response_model=Proposal)
async def comment(id: str, body: TextBody) -> Proposal:
    raise not_implemented("proposals.comment")


@router.post("/proposals/{id}/decide", operation_id="proposals.decide", summary="Leader 決策", response_model=Proposal)
async def decide(id: str, body: DecideProposalInput) -> Proposal:
    raise not_implemented("proposals.decide")
