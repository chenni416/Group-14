"""問題回報與提案（資料庫版）：目前只有讀取（列表）。

Active Board 一載入就會讀問題與提案列表，這兩個端點回 501 時整個看板會一直停在載入畫面，所以先做讀取；
新增、回應、決策等寫入（issues.report、proposals.create…）之後再做。
前端的 Issue.sprintId、Proposal.sprintId 是 Sprint 編號，任務 id 是任務編號（tasks.code）。
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Issue as IssueRow
from app.models import IssueResponse as IssueResponseRow
from app.models import Proposal as ProposalRow
from app.models import ProposalComment as ProposalCommentRow
from app.models import Sprint as SprintRow
from app.models import Task as TaskRow
from app.schemas.collab import Issue, IssueResponse, Proposal, ProposalComment


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def _member(value: uuid.UUID | None) -> str | None:
    return str(value) if value else None


def list_issues(db: Session, project_id: uuid.UUID) -> list[Issue]:
    """這個專案的問題，新的在前"""
    rows = db.execute(
        select(IssueRow, TaskRow.code, SprintRow.number)
        .join(TaskRow, IssueRow.task_id == TaskRow.id)
        .join(SprintRow, TaskRow.sprint_id == SprintRow.id)
        .where(TaskRow.project_id == project_id)
        .order_by(IssueRow.created_at.desc(), IssueRow.id)
    ).all()
    responses: dict[uuid.UUID, list[IssueResponse]] = {}
    if rows:
        for r in db.scalars(
            select(IssueResponseRow)
            .where(IssueResponseRow.issue_id.in_([i.id for i, _, _ in rows]))
            .order_by(IssueResponseRow.created_at, IssueResponseRow.id)
        ):
            responses.setdefault(r.issue_id, []).append(
                IssueResponse(id=str(r.id), by_id=_member(r.author_member_id) or "", text=r.text, at=_iso(r.created_at))
            )
    return [
        Issue(
            id=str(i.id),
            task_id=code,
            type=i.type,  # type: ignore[arg-type]
            description=i.description,
            reporter_id=_member(i.reporter_member_id) or "",
            owner_id=_member(i.owner_member_id),
            suggested_owner_id=_member(i.suggested_owner_member_id),
            owner_reason=i.owner_reason,
            status=i.status,  # type: ignore[arg-type]
            responses=responses.get(i.id, []),
            created_at=_iso(i.created_at),
            updated_at=_iso(i.updated_at),
            sprint_id=number,
        )
        for i, code, number in rows
    ]


def list_proposals(db: Session, project_id: uuid.UUID) -> list[Proposal]:
    """這個專案的提案，新的在前"""
    rows = db.execute(
        select(ProposalRow, SprintRow.number, TaskRow.code)
        .join(SprintRow, ProposalRow.sprint_id == SprintRow.id)
        .outerjoin(TaskRow, ProposalRow.task_id == TaskRow.id)
        .where(SprintRow.project_id == project_id)
        .order_by(ProposalRow.created_at.desc(), ProposalRow.id)
    ).all()
    comments: dict[uuid.UUID, list[ProposalComment]] = {}
    if rows:
        for c in db.scalars(
            select(ProposalCommentRow)
            .where(ProposalCommentRow.proposal_id.in_([p.id for p, _, _ in rows]))
            .order_by(ProposalCommentRow.created_at, ProposalCommentRow.id)
        ):
            comments.setdefault(c.proposal_id, []).append(
                ProposalComment(
                    id=str(c.id), by_id=_member(c.author_member_id) or "", text=c.text, at=_iso(c.created_at)
                )
            )
    return [
        Proposal(
            id=str(p.id),
            title=p.title,
            description=p.description,
            kind=p.kind,  # type: ignore[arg-type]
            author_id=_member(p.author_member_id) or "",
            task_id=code,
            status=p.status,  # type: ignore[arg-type]
            decision=p.decision,
            decided_by_id=_member(p.decided_by_member_id),
            comments=comments.get(p.id, []),
            created_at=_iso(p.created_at),
            sprint_id=number,
        )
        for p, number, code in rows
    ]
