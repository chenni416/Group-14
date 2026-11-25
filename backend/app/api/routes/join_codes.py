"""邀請碼加入 API，對應前端 contracts.ts 的 joinCodes。

- Leader：查看、產生、停用目前專案的邀請碼；列出、同意、拒絕加入申請
- 任何登入的人：輸入邀請碼送出申請、查看與取消自己的申請
- 開發用的示範成員（X-Demo-User）不能使用：查詢回傳空的，其他操作回傳 400
"""

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.api.deps import Db, ProjectId
from app.core.auth import CurrentMember, require_leader
from app.core.errors import ApiError
from app.schemas.join_code import CreateJoinCodeInput, JoinCode, JoinRequest, SubmitJoinCodeInput
from app.services import join_codes, projects

router = APIRouter(tags=["邀請碼加入"])


def _github_member(me: CurrentMember):
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        raise ApiError("示範身分無法使用邀請碼，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    return member_id


def _leader_project(me: CurrentMember, db: Session, project_id: str | None):
    """Leader 的目前專案：(成員 id, 專案 id)"""
    require_leader(me)
    member_id = _github_member(me)
    return member_id, projects.require_current_project_id(db, member_id, project_id)


# ---------- Leader：邀請碼 ----------


@router.get(
    "/join-codes/current",
    operation_id="joinCodes.current",
    summary="目前有效的邀請碼（Leader）",
    response_model=JoinCode | None,
)
def current_code(me: CurrentMember, db: Db, project_id: ProjectId = None) -> JoinCode | None:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return None
    return join_codes.get_current_code(db, projects.require_current_project_id(db, member_id, project_id))


@router.post(
    "/join-codes", operation_id="joinCodes.create", summary="產生新的邀請碼（Leader）", response_model=JoinCode
)
def create_code(body: CreateJoinCodeInput, me: CurrentMember, db: Db, project_id: ProjectId = None) -> JoinCode:
    member_id, current = _leader_project(me, db, project_id)
    return join_codes.create_code(db, current, member_id, body)


@router.delete("/join-codes/current", operation_id="joinCodes.revoke", summary="停用邀請碼（Leader）", status_code=204)
def revoke_code(me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    _, current = _leader_project(me, db, project_id)
    join_codes.revoke_code(db, current)


# ---------- Leader：審核申請 ----------


@router.get(
    "/join-requests",
    operation_id="joinCodes.listRequests",
    summary="待審核的加入申請（Leader）",
    response_model=list[JoinRequest],
)
def list_requests(me: CurrentMember, db: Db, project_id: ProjectId = None) -> list[JoinRequest]:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return []
    return join_codes.list_project_requests(db, projects.require_current_project_id(db, member_id, project_id))


@router.post(
    "/join-requests/{id}/approve", operation_id="joinCodes.approve", summary="同意加入申請（Leader）", status_code=204
)
def approve(id: str, me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    member_id, current = _leader_project(me, db, project_id)
    join_codes.decide_request(db, current, member_id, id, approve=True)


@router.post(
    "/join-requests/{id}/reject", operation_id="joinCodes.reject", summary="拒絕加入申請（Leader）", status_code=204
)
def reject(id: str, me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    member_id, current = _leader_project(me, db, project_id)
    join_codes.decide_request(db, current, member_id, id, approve=False)


# ---------- 申請的人 ----------


@router.post(
    "/join-requests", operation_id="joinCodes.submit", summary="輸入邀請碼送出加入申請", response_model=JoinRequest
)
def submit(body: SubmitJoinCodeInput, me: CurrentMember, db: Db) -> JoinRequest:
    return join_codes.submit_request(db, _github_member(me), body.code)


@router.get(
    "/join-requests/mine", operation_id="joinCodes.mine", summary="我送出的加入申請", response_model=list[JoinRequest]
)
def my_requests(me: CurrentMember, db: Db) -> list[JoinRequest]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return []
    return join_codes.list_my_requests(db, member_id)


@router.delete("/join-requests/{id}", operation_id="joinCodes.cancel", summary="取消我的加入申請", status_code=204)
def cancel(id: str, me: CurrentMember, db: Db) -> None:
    join_codes.cancel_my_request(db, _github_member(me), id)
