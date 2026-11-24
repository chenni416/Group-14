"""成員邀請（指定 GitHub 帳號）：project_invitations 資料表的讀寫。

流程：Leader 輸入對方的 GitHub 帳號 → 向 GitHub 確認帳號存在 → 建立邀請（pending）
→ 對方以 GitHub 登入後，在「加入專案」頁看到邀請 → 接受後加入專案（或拒絕）。
不寄信；只有被邀請的 GitHub 帳號能接受。
"""

import re
import uuid
from datetime import UTC, datetime

import httpx
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Member as MemberRow
from app.models import Project as ProjectRow
from app.models import ProjectInvitation as InvitationRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.invitation import CreateInvitationInput, Invitation

# GitHub 帳號：英數字與連字號，最多 39 個字
LOGIN_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$")


def normalize_login(login: str) -> str:
    """去掉前後空白與開頭的 @，轉成小寫"""
    return login.strip().lstrip("@").lower()


def lookup_github_user(login: str) -> int | None:
    """向 GitHub 確認帳號存在，回傳 GitHub id。

    帳號不存在 → 422；GitHub 暫時查不到（網路錯誤、次數限制）→ 回傳 None，仍可建立邀請，接受時改用帳號名稱比對。
    """
    try:
        res = httpx.get(f"https://api.github.com/users/{login}", timeout=5)
    except httpx.HTTPError:
        return None
    if res.status_code == 404:
        raise ApiError(f"找不到 GitHub 帳號 @{login}", status=422, code="GITHUB_USER_NOT_FOUND")
    if res.status_code != 200:
        return None
    return res.json().get("id")


def _now() -> datetime:
    return datetime.now(UTC)


def _to_schema(inv: InvitationRow, project: ProjectRow, inviter: MemberRow | None) -> Invitation:
    return Invitation(
        id=str(inv.id),
        project_id=str(project.id),
        project_name=project.name,
        github_login=inv.github_login,
        role=inv.role,
        title=inv.title,
        domain=inv.domain,
        capacity=inv.capacity,
        status=inv.status,
        invited_by_name=(inviter.display_name or inviter.github_login) if inviter else "",
        created_at=inv.created_at,
    )


def _query():
    """邀請連同專案與邀請人"""
    return (
        select(InvitationRow, ProjectRow, MemberRow)
        .join(ProjectRow, ProjectRow.id == InvitationRow.project_id)
        .outerjoin(MemberRow, MemberRow.id == InvitationRow.invited_by_member_id)
    )


def create_invitation(
    db: Session, project_id: uuid.UUID, inviter_id: uuid.UUID, body: CreateInvitationInput
) -> Invitation:
    login = normalize_login(body.github_login)
    if not LOGIN_PATTERN.match(login):
        raise ApiError("請輸入正確的 GitHub 帳號", status=422, code="VALIDATION_ERROR")

    already_member = db.execute(
        select(ProjectMemberRow)
        .join(MemberRow, MemberRow.id == ProjectMemberRow.member_id)
        .where(ProjectMemberRow.project_id == project_id, func.lower(MemberRow.github_login) == login)
    ).first()
    if already_member:
        raise ApiError(f"@{login} 已經是專案成員", status=409, code="ALREADY_MEMBER")

    pending = db.scalars(
        select(InvitationRow).where(
            InvitationRow.project_id == project_id,
            InvitationRow.github_login == login,
            InvitationRow.status == "pending",
        )
    ).first()
    if pending:
        raise ApiError(f"已經邀請過 @{login}，等待對方接受", status=409, code="ALREADY_INVITED")

    github_id = lookup_github_user(login)
    inv = InvitationRow(
        project_id=project_id,
        github_login=login,
        github_id=github_id,
        role=body.role,
        title=body.title.strip(),
        domain=body.domain,
        capacity=max(0, body.capacity),
        invited_by_member_id=inviter_id,
    )
    db.add(inv)
    db.commit()
    project = db.get(ProjectRow, project_id)
    return _to_schema(inv, project, db.get(MemberRow, inviter_id))


def list_project_invitations(db: Session, project_id: uuid.UUID) -> list[Invitation]:
    """專案的邀請：待接受的在前，其次新的在前"""
    rows = db.execute(
        _query()
        .where(InvitationRow.project_id == project_id)
        .order_by((InvitationRow.status == "pending").desc(), InvitationRow.created_at.desc())
    ).all()
    return [_to_schema(i, p, m) for i, p, m in rows]


def revoke_invitation(db: Session, project_id: uuid.UUID, invitation_id: str) -> None:
    inv = _find(db, invitation_id)
    if inv is None or inv.project_id != project_id:
        raise ApiError("找不到這個邀請", status=404, code="NOT_FOUND")
    if inv.status != "pending":
        raise ApiError("這個邀請已經處理過了", status=409, code="INVITATION_CLOSED")
    inv.status = "revoked"
    inv.responded_at = _now()
    db.commit()


def _mine(me: MemberRow):
    """比對被邀請的帳號：GitHub id 相同，或帳號名稱相同（不分大小寫）"""
    conditions = [InvitationRow.github_login == (me.github_login or "").lower()]
    if me.github_id is not None:
        conditions.append(InvitationRow.github_id == me.github_id)
    return or_(*conditions)


def list_my_invitations(db: Session, member_id: uuid.UUID) -> list[Invitation]:
    """寄給我、還沒處理的邀請"""
    me = db.get(MemberRow, member_id)
    if me is None:
        return []
    rows = db.execute(
        _query().where(InvitationRow.status == "pending", _mine(me)).order_by(InvitationRow.created_at.desc())
    ).all()
    return [_to_schema(i, p, m) for i, p, m in rows]


def _find(db: Session, invitation_id: str) -> InvitationRow | None:
    try:
        return db.get(InvitationRow, uuid.UUID(invitation_id))
    except ValueError:
        return None


def _find_mine(db: Session, member_id: uuid.UUID, invitation_id: str) -> tuple[InvitationRow, MemberRow]:
    """找到寄給我、還沒處理的邀請；不是寄給我的一律回傳 404，不透露邀請是否存在"""
    me = db.get(MemberRow, member_id)
    inv = _find(db, invitation_id)
    if me is None or inv is None:
        raise ApiError("找不到這個邀請", status=404, code="NOT_FOUND")
    mine = inv.github_login == (me.github_login or "").lower() or (
        inv.github_id is not None and inv.github_id == me.github_id
    )
    if not mine:
        raise ApiError("找不到這個邀請", status=404, code="NOT_FOUND")
    if inv.status != "pending":
        raise ApiError("這個邀請已經處理過或被撤銷了", status=409, code="INVITATION_CLOSED")
    return inv, me


def accept_invitation(db: Session, member_id: uuid.UUID, invitation_id: str) -> str:
    """接受邀請並加入專案，回傳專案 id"""
    inv, me = _find_mine(db, member_id, invitation_id)
    exists = db.get(ProjectMemberRow, (inv.project_id, me.id))
    if exists is None:
        if inv.role == "Leader":
            # 一個專案只有一位 Leader：原本的 Leader 改為 Member
            for pm in db.scalars(
                select(ProjectMemberRow).where(
                    ProjectMemberRow.project_id == inv.project_id, ProjectMemberRow.role == "Leader"
                )
            ):
                pm.role = "Member"
        db.add(
            ProjectMemberRow(
                project_id=inv.project_id,
                member_id=me.id,
                role=inv.role,
                title=inv.title,
                domain=inv.domain,
                capacity=inv.capacity,
                joined_at=_now(),
            )
        )
    inv.status = "accepted"
    inv.accepted_by_member_id = me.id
    inv.responded_at = _now()
    db.commit()
    return str(inv.project_id)


def decline_invitation(db: Session, member_id: uuid.UUID, invitation_id: str) -> None:
    inv, _ = _find_mine(db, member_id, invitation_id)
    inv.status = "declined"
    inv.responded_at = _now()
    db.commit()
