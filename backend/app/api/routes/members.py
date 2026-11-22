"""成員 API，對應前端 contracts.ts 的 members。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.auth import CurrentMember, require_leader
from app.repo import Store
from app.schemas.member import InviteMemberInput, Member, UpdateMemberInput
from app.services import workspace_flow

router = APIRouter(tags=["成員"])


@router.get("/members", operation_id="members.list", summary="專案成員列表", response_model=list[Member])
async def list_members(store: Store) -> list[Member]:
    return store.members


@router.post("/members", operation_id="members.invite", summary="邀請成員", response_model=Member)
async def invite(body: InviteMemberInput, store: Store, me: CurrentMember) -> Member:
    require_leader(me)
    return workspace_flow.invite_member(store, body)


@router.patch("/members/{id}", operation_id="members.update", summary="修改成員資料", response_model=Member)
async def update(id: str, body: UpdateMemberInput, store: Store, me: CurrentMember) -> Member:
    require_leader(me)
    return workspace_flow.update_member(store, id, body)
