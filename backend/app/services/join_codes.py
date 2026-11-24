"""邀請碼加入：project_join_codes、project_join_requests 資料表的讀寫。

流程：Leader 產生邀請碼 → 任何人登入後輸入邀請碼送出申請 → Leader 同意後加入專案（或拒絕）。
同一個專案同時只有一組有效的邀請碼；產生新碼時停用舊碼。規格見 docs/github.md 第 7.2 節。
"""

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Member as MemberRow
from app.models import Project as ProjectRow
from app.models import ProjectJoinCode as CodeRow
from app.models import ProjectJoinRequest as RequestRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.join_code import CreateJoinCodeInput, JoinCode, JoinRequest

# 去掉容易看錯的字：0 與 O、1 與 I
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_DAYS = 30


def _now() -> datetime:
    return datetime.now(UTC)


def _active_code(db: Session, project_id: uuid.UUID) -> CodeRow | None:
    """專案目前有效的邀請碼：沒有停用、沒有過期"""
    return db.scalars(
        select(CodeRow).where(
            CodeRow.project_id == project_id,
            CodeRow.revoked_at.is_(None),
            or_(CodeRow.expires_at.is_(None), CodeRow.expires_at > _now()),
        )
    ).first()


def _code_schema(row: CodeRow) -> JoinCode:
    return JoinCode(code=row.code, role=row.role, expires_at=row.expires_at, created_at=row.created_at)


def get_current_code(db: Session, project_id: uuid.UUID) -> JoinCode | None:
    row = _active_code(db, project_id)
    return _code_schema(row) if row else None


def create_code(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, body: CreateJoinCodeInput) -> JoinCode:
    """產生新的邀請碼，同時停用舊的"""
    if body.expires_in_days is not None and not 1 <= body.expires_in_days <= MAX_DAYS:
        raise ApiError(f"有效天數要在 1～{MAX_DAYS} 天之間", status=422, code="VALIDATION_ERROR")
    old = _active_code(db, project_id)
    if old:
        old.revoked_at = _now()

    project = db.get(ProjectRow, project_id)
    while True:
        # 例如 TL-7K2QX9：專案代碼加上隨機碼；萬一重複就重新產生
        code = f"{project.prefix}-{''.join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))}"
        if db.scalars(select(CodeRow).where(CodeRow.code == code)).first() is None:
            break
    row = CodeRow(
        project_id=project_id,
        code=code,
        role=body.role,
        expires_at=_now() + timedelta(days=body.expires_in_days) if body.expires_in_days else None,
        created_by_member_id=member_id,
    )
    db.add(row)
    db.commit()
    return _code_schema(row)


def revoke_code(db: Session, project_id: uuid.UUID) -> None:
    row = _active_code(db, project_id)
    if row:
        row.revoked_at = _now()
        db.commit()


def _request_schema(req: RequestRow, project: ProjectRow, member: MemberRow) -> JoinRequest:
    return JoinRequest(
        id=str(req.id),
        project_id=str(project.id),
        project_name=project.name,
        member_id=str(member.id),
        member_name=member.display_name or member.github_login,
        github_login=member.github_login,
        avatar_url=member.avatar_url or "",
        status=req.status,
        created_at=req.created_at,
    )


def _requests():
    """申請連同專案與申請人"""
    return (
        select(RequestRow, ProjectRow, MemberRow)
        .join(ProjectRow, ProjectRow.id == RequestRow.project_id)
        .join(MemberRow, MemberRow.id == RequestRow.member_id)
    )


def submit_request(db: Session, member_id: uuid.UUID, code: str) -> JoinRequest:
    """輸入邀請碼送出加入申請"""
    normalized = code.strip().upper()
    row = db.scalars(select(CodeRow).where(CodeRow.code == normalized)).first()
    if row is None or row.revoked_at is not None or (row.expires_at is not None and row.expires_at <= _now()):
        raise ApiError("邀請碼無效或已過期，請向 Leader 索取新的邀請碼", status=404, code="INVALID_JOIN_CODE")
    if db.get(ProjectMemberRow, (row.project_id, member_id)):
        raise ApiError("你已經是這個專案的成員", status=409, code="ALREADY_MEMBER")
    pending = db.scalars(
        select(RequestRow).where(
            RequestRow.project_id == row.project_id,
            RequestRow.member_id == member_id,
            RequestRow.status == "pending",
        )
    ).first()
    if pending:
        raise ApiError("已經送出申請，請等待 Leader 同意", status=409, code="ALREADY_REQUESTED")

    req = RequestRow(project_id=row.project_id, join_code_id=row.id, member_id=member_id)
    db.add(req)
    db.commit()
    return _request_schema(req, db.get(ProjectRow, row.project_id), db.get(MemberRow, member_id))


def list_my_requests(db: Session, member_id: uuid.UUID) -> list[JoinRequest]:
    """我送出、還在等待審核的申請"""
    rows = db.execute(
        _requests()
        .where(RequestRow.member_id == member_id, RequestRow.status == "pending")
        .order_by(RequestRow.created_at.desc())
    ).all()
    return [_request_schema(r, p, m) for r, p, m in rows]


def cancel_my_request(db: Session, member_id: uuid.UUID, request_id: str) -> None:
    req = _find(db, request_id)
    if req is None or req.member_id != member_id:
        raise ApiError("找不到這個申請", status=404, code="NOT_FOUND")
    if req.status != "pending":
        raise ApiError("這個申請已經處理過了", status=409, code="REQUEST_CLOSED")
    req.status = "cancelled"
    req.decided_at = _now()
    db.commit()


def list_project_requests(db: Session, project_id: uuid.UUID) -> list[JoinRequest]:
    """專案待審核的申請，先送出的在前"""
    rows = db.execute(
        _requests()
        .where(RequestRow.project_id == project_id, RequestRow.status == "pending")
        .order_by(RequestRow.created_at)
    ).all()
    return [_request_schema(r, p, m) for r, p, m in rows]


def _find(db: Session, request_id: str) -> RequestRow | None:
    try:
        return db.get(RequestRow, uuid.UUID(request_id))
    except ValueError:
        return None


def decide_request(db: Session, project_id: uuid.UUID, leader_id: uuid.UUID, request_id: str, *, approve: bool) -> None:
    """Leader 同意或拒絕申請；同意時以邀請碼設定的角色加入專案"""
    req = _find(db, request_id)
    if req is None or req.project_id != project_id:
        raise ApiError("找不到這個申請", status=404, code="NOT_FOUND")
    if req.status != "pending":
        raise ApiError("這個申請已經處理過了", status=409, code="REQUEST_CLOSED")

    if approve and db.get(ProjectMemberRow, (project_id, req.member_id)) is None:
        code = db.get(CodeRow, req.join_code_id) if req.join_code_id else None
        role = code.role if code else "Member"
        if role == "Leader":
            # 一個專案只有一位 Leader：原本的 Leader 改為 Member
            for pm in db.scalars(
                select(ProjectMemberRow).where(
                    ProjectMemberRow.project_id == project_id, ProjectMemberRow.role == "Leader"
                )
            ):
                pm.role = "Member"
        db.add(ProjectMemberRow(project_id=project_id, member_id=req.member_id, role=role, joined_at=_now()))
    req.status = "approved" if approve else "rejected"
    req.decided_by_member_id = leader_id
    req.decided_at = _now()
    db.commit()
