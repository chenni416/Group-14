"""成員邀請 API（指定 GitHub 帳號），對應前端 contracts.ts 的 invitations。

- Leader：建立、列出、撤銷目前專案的邀請
- 被邀請的人：列出寄給我的邀請、接受、拒絕
- 開發用的示範成員（X-Demo-User）不能使用：列表回傳空的，其他操作回傳 400
"""

from fastapi import APIRouter

from app.api.deps import Db, ProjectId
from app.core.auth import CurrentMember, require_leader
from app.core.errors import ApiError
from app.schemas.base import ApiModel
from app.schemas.invitation import CreateInvitationInput, Invitation
from app.services import invitations, projects

router = APIRouter(tags=["成員邀請"])


class AcceptResult(ApiModel):
    project_id: str
    """加入的專案；前端切換到這個專案"""


def _github_member(me: CurrentMember):
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        raise ApiError("示範身分無法使用邀請，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    return member_id


@router.get(
    "/invitations", operation_id="invitations.list", summary="目前專案的邀請（Leader）", response_model=list[Invitation]
)
def list_invitations(me: CurrentMember, db: Db, project_id: ProjectId = None) -> list[Invitation]:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return []
    return invitations.list_project_invitations(db, projects.require_current_project_id(db, member_id, project_id))


@router.post(
    "/invitations",
    operation_id="invitations.create",
    summary="用 GitHub 帳號邀請成員（Leader）",
    response_model=Invitation,
)
def create_invitation(
    body: CreateInvitationInput, me: CurrentMember, db: Db, project_id: ProjectId = None
) -> Invitation:
    require_leader(me)
    member_id = _github_member(me)
    current = projects.require_current_project_id(db, member_id, project_id)
    return invitations.create_invitation(db, current, member_id, body)


@router.delete("/invitations/{id}", operation_id="invitations.revoke", summary="撤銷邀請（Leader）", status_code=204)
def revoke_invitation(id: str, me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    require_leader(me)
    member_id = _github_member(me)
    invitations.revoke_invitation(db, projects.require_current_project_id(db, member_id, project_id), id)


@router.get(
    "/invitations/mine", operation_id="invitations.mine", summary="寄給我的邀請", response_model=list[Invitation]
)
def my_invitations(me: CurrentMember, db: Db) -> list[Invitation]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return []
    return invitations.list_my_invitations(db, member_id)


@router.post(
    "/invitations/{id}/accept", operation_id="invitations.accept", summary="接受邀請", response_model=AcceptResult
)
def accept_invitation(id: str, me: CurrentMember, db: Db) -> AcceptResult:
    return AcceptResult(project_id=invitations.accept_invitation(db, _github_member(me), id))


@router.post("/invitations/{id}/decline", operation_id="invitations.decline", summary="拒絕邀請", status_code=204)
def decline_invitation(id: str, me: CurrentMember, db: Db) -> None:
    invitations.decline_invitation(db, _github_member(me), id)
