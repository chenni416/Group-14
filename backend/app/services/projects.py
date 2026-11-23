"""專案：projects、project_members 資料表的讀寫（GitHub 登入的成員使用）。

- 一個成員可以參與多個專案；前端以 X-Project-Id 標頭指定目前的專案，沒有指定時使用最近加入的專案
- 建立專案的人自動成為 Leader
- 開發用的示範成員（X-Demo-User）不經過這裡，繼續使用 MemoryStore
"""

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Project as ProjectRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.project import CreateProjectInput, Project, ProjectSummary, ReviewPolicy

DEFAULT_BRANCH_PATTERN = "{類型}/S{Sprint}{Story}{Task}-{摘要}"
NAME_MAX = 100
PREFIX_MAX = 6


def parse_uuid(value: str | None) -> uuid.UUID | None:
    """資料庫的 id 是 uuid；不是 uuid（例如示範成員 m1、示範專案 taskline）時回傳 None"""
    try:
        return uuid.UUID(value) if value else None
    except ValueError:
        return None


def normalize_prefix(prefix: str) -> str:
    """專案代碼只保留英文大寫與數字"""
    return re.sub(r"[^A-Z0-9]", "", prefix.upper())[:PREFIX_MAX]


def list_my_projects(db: Session, member_id: uuid.UUID) -> list[ProjectSummary]:
    """我參與的專案，最近加入的在前"""
    rows = db.execute(
        select(ProjectRow, ProjectMemberRow.role)
        .join(ProjectMemberRow, ProjectMemberRow.project_id == ProjectRow.id)
        .where(ProjectMemberRow.member_id == member_id)
        .order_by(ProjectMemberRow.joined_at.desc())
    ).all()
    return [ProjectSummary(id=str(p.id), name=p.name, prefix=p.prefix, role=role) for p, role in rows]


def current_membership(
    db: Session, member_id: uuid.UUID, project_id: str | None
) -> tuple[ProjectRow, ProjectMemberRow] | None:
    """目前的專案與我在專案中的設定；指定的專案無效或我不是成員時，改用最近加入的專案。都沒有時回傳 None"""
    query = (
        select(ProjectRow, ProjectMemberRow)
        .join(ProjectMemberRow, ProjectMemberRow.project_id == ProjectRow.id)
        .where(ProjectMemberRow.member_id == member_id)
    )
    wanted = parse_uuid(project_id)
    if wanted is not None:
        row = db.execute(query.where(ProjectRow.id == wanted)).first()
        if row is not None:
            return row[0], row[1]
    row = db.execute(query.order_by(ProjectMemberRow.joined_at.desc()).limit(1)).first()
    return (row[0], row[1]) if row is not None else None


def create_project(db: Session, member_id: uuid.UUID, body: CreateProjectInput) -> ProjectSummary:
    """建立專案，建立的人成為 Leader"""
    name = body.name.strip()
    prefix = normalize_prefix(body.prefix)
    if not name:
        raise ApiError("請輸入專案名稱", status=422, code="VALIDATION_ERROR")
    if len(name) > NAME_MAX:
        raise ApiError(f"專案名稱最多 {NAME_MAX} 個字", status=422, code="VALIDATION_ERROR")
    if not prefix:
        raise ApiError("專案代碼需要至少一個英文字母或數字", status=422, code="VALIDATION_ERROR")

    project = ProjectRow(
        name=name,
        prefix=prefix,
        goal=body.goal.strip(),
        branch_pattern=DEFAULT_BRANCH_PATTERN,
        created_by_member_id=member_id,
    )
    db.add(project)
    db.flush()  # 先取得 project.id，才能建立成員關係
    # 加入時間用程式的時間：同一個交易裡建立多個專案時，資料庫的 now() 會相同，無法分辨先後
    db.add(ProjectMemberRow(project_id=project.id, member_id=member_id, role="Leader", joined_at=datetime.now(UTC)))
    db.commit()
    return ProjectSummary(id=str(project.id), name=project.name, prefix=project.prefix, role="Leader")


def to_schema(row: ProjectRow) -> Project:
    """轉成前端的 Project；Sprint 尚未改用資料表，先以 0 表示沒有進行中的 Sprint"""
    return Project(
        name=row.name,
        goal=row.goal,
        prefix=row.prefix,
        provider="GitHub",
        repo=row.github_repo_full_name or "",
        branch_pattern=row.branch_pattern,
        sprint_length=row.sprint_length,
        default_policy=ReviewPolicy.model_validate(row.default_policy),
        active_sprint_id=0,
        planning_sprint_id=None,
    )
