"""通知：notifications 資料表的讀寫（GitHub 登入的成員使用）。

目前由成員邀請與邀請碼產生通知：
- 被邀請（type = invite）→ 被邀請的人；對方還沒登入過時沒有成員資料，第一次讀通知時補上
- 接受、拒絕邀請 → 邀請人；用邀請碼申請 → 專案的 Leader；同意、拒絕申請 → 申請人（type = info）

ref_id 指向邀請（project_invitations）或申請（project_join_requests），讀取時由它查出專案與要前往的頁面。
"""

import uuid

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Member as MemberRow
from app.models import Notification as NotificationRow
from app.models import Project as ProjectRow
from app.models import ProjectInvitation as InvitationRow
from app.models import ProjectJoinRequest as RequestRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.collab import Notification

LIST_LIMIT = 50


def name_of(member: MemberRow | None) -> str:
    return (member.display_name or member.github_login) if member else "有人"


def add(
    db: Session,
    recipient_id: uuid.UUID,
    sender_id: uuid.UUID | None,
    text: str,
    ref_id: uuid.UUID,
    *,
    invite: bool = False,
) -> None:
    """新增一則通知（不 commit，跟著呼叫者的修改一起存檔）"""
    db.add(
        NotificationRow(
            recipient_member_id=recipient_id,
            sender_member_id=sender_id,
            type="invite" if invite else "info",
            ref_id=ref_id,
            text=text,
        )
    )


def notify_leaders(db: Session, project_id: uuid.UUID, sender_id: uuid.UUID, text: str, ref_id: uuid.UUID) -> None:
    """通知專案所有的 Leader"""
    for leader_id in db.scalars(
        select(ProjectMemberRow.member_id).where(
            ProjectMemberRow.project_id == project_id, ProjectMemberRow.role == "Leader"
        )
    ):
        add(db, leader_id, sender_id, text, ref_id)


def close(db: Session, ref_id: uuid.UUID) -> None:
    """邀請或申請處理完後，相關的通知改為已處理（不 commit）"""
    db.execute(update(NotificationRow).where(NotificationRow.ref_id == ref_id).values(status="done"))


def _backfill_invitations(db: Session, me: MemberRow) -> None:
    """寄給我的邀請在我第一次登入前就建立了：補上通知"""
    conditions = [InvitationRow.github_login == (me.github_login or "").lower()]
    if me.github_id is not None:
        conditions.append(InvitationRow.github_id == me.github_id)
    notified = select(NotificationRow.ref_id).where(NotificationRow.recipient_member_id == me.id)
    invitations = db.scalars(
        select(InvitationRow).where(
            InvitationRow.status == "pending", or_(*conditions), InvitationRow.id.not_in(notified)
        )
    ).all()
    for inv in invitations:
        project = db.get(ProjectRow, inv.project_id)
        inviter = db.get(MemberRow, inv.invited_by_member_id)
        add(
            db, me.id, inv.invited_by_member_id, f"{name_of(inviter)} 邀請你加入「{project.name}」", inv.id, invite=True
        )
    if invitations:
        db.commit()


def _target(db: Session, row: NotificationRow) -> tuple[str | None, str | None]:
    """通知要前往的頁面與專案：(link, project_id)"""
    if row.ref_id is None:
        return None, None
    inv = db.get(InvitationRow, row.ref_id)
    if inv is not None:
        if row.type == "invite":
            return "/projects/join", None
        return "/team", str(inv.project_id)
    req = db.get(RequestRow, row.ref_id)
    if req is not None:
        if row.recipient_member_id == req.member_id:
            # 申請人：同意後前往該專案；被拒絕時不需要前往
            return ("/", str(req.project_id)) if req.status == "approved" else (None, None)
        return "/team", str(req.project_id)
    return None, None


def list_mine(db: Session, member_id: uuid.UUID) -> list[Notification]:
    """我的通知，新的在前"""
    me = db.get(MemberRow, member_id)
    if me is None:
        return []
    _backfill_invitations(db, me)
    rows = db.scalars(
        select(NotificationRow)
        .where(NotificationRow.recipient_member_id == member_id)
        .order_by(NotificationRow.created_at.desc())
        .limit(LIST_LIMIT)
    ).all()
    result = []
    for row in rows:
        link, project_id = _target(db, row)
        result.append(
            Notification(
                id=str(row.id),
                to_id=str(row.recipient_member_id),
                from_id=str(row.sender_member_id or ""),
                type=row.type,
                task_id=str(row.task_id or ""),
                ref_id=str(row.ref_id) if row.ref_id else None,
                text=row.text,
                created_at=row.created_at.isoformat(),
                status=row.status,
                link=link,
                project_id=project_id,
            )
        )
    return result


def mark_read(db: Session, member_id: uuid.UUID, notification_id: str) -> None:
    try:
        row = db.get(NotificationRow, uuid.UUID(notification_id))
    except ValueError:
        row = None
    if row is None or row.recipient_member_id != member_id:
        raise ApiError("找不到這則通知", status=404, code="NOT_FOUND")
    row.status = "done"
    db.commit()


def mark_all_read(db: Session, member_id: uuid.UUID) -> None:
    db.execute(
        update(NotificationRow)
        .where(NotificationRow.recipient_member_id == member_id, NotificationRow.status == "pending")
        .values(status="done")
    )
    db.commit()
