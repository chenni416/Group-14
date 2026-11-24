"""成員 API，對應前端 contracts.ts 的 members。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts

- GitHub 登入的成員：讀寫 members、project_members 資料表（app/services/projects.py）
- 開發用的示範成員（X-Demo-User）：沿用記憶體版假資料（MemoryStore）
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.auth import CurrentMember, require_leader
from app.core.errors import ApiError
from app.db.session import get_db
from app.repo import Store
from app.schemas.member import InviteMemberInput, Member, UpdateMemberInput
from app.services import projects, workspace_flow

router = APIRouter(tags=["成員"])

Db = Annotated[Session, Depends(get_db)]
ProjectId = Annotated[str | None, Header(alias="X-Project-Id")]


def _current_project_id(db: Session, me: CurrentMember, project_id: str | None):
    """GitHub 登入的成員目前的專案 id；示範成員回傳 None"""
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return None
    current = projects.current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return current[0].id


@router.get("/members", operation_id="members.list", summary="專案成員列表", response_model=list[Member])
def list_members(me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> list[Member]:
    current = _current_project_id(db, me, project_id)
    if current is None:
        return store.members
    return projects.list_project_members(db, current)


@router.post("/members", operation_id="members.invite", summary="邀請成員", response_model=Member)
def invite(body: InviteMemberInput, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> Member:
    require_leader(me)
    if _current_project_id(db, me, project_id) is None:
        return workspace_flow.invite_member(store, body)
    raise ApiError("邀請成員功能尚未完成", status=501, code="NOT_IMPLEMENTED")


@router.patch("/members/{id}", operation_id="members.update", summary="修改成員資料", response_model=Member)
def update(
    id: str, body: UpdateMemberInput, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None
) -> Member:
    require_leader(me)
    current = _current_project_id(db, me, project_id)
    if current is None:
        return workspace_flow.update_member(store, id, body)
    return projects.update_project_member(db, current, id, body)
