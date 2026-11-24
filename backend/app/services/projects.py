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
from app.models import Member as MemberRow
from app.models import Project as ProjectRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.member import Member, UpdateMemberInput
from app.schemas.project import CreateProjectInput, Project, ProjectSummary, ReviewPolicy, UpdateProjectInput

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


def require_current_project_id(db: Session, member_id: uuid.UUID, project_id: str | None) -> uuid.UUID:
    """目前專案的 id；還沒有任何專案時回傳 404"""
    current = current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return current[0].id


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


def update_project(db: Session, project: ProjectRow, patch: UpdateProjectInput) -> ProjectRow:
    """修改專案設定：只改前端有傳的欄位。Git 平台與 repo 由 GitHub 整合處理，這裡不修改"""
    if patch.name is not None:
        name = patch.name.strip()
        if not name:
            raise ApiError("請輸入專案名稱", status=422, code="VALIDATION_ERROR")
        project.name = name[:NAME_MAX]
    if patch.goal is not None:
        project.goal = patch.goal.strip()
    if patch.prefix is not None:
        prefix = normalize_prefix(patch.prefix)
        if not prefix:
            raise ApiError("專案代碼需要至少一個英文字母或數字", status=422, code="VALIDATION_ERROR")
        project.prefix = prefix
    if patch.branch_pattern is not None:
        project.branch_pattern = patch.branch_pattern.strip()
    if patch.sprint_length is not None:
        project.sprint_length = patch.sprint_length
    if patch.default_policy is not None:
        project.default_policy = patch.default_policy.model_dump()
    project.updated_at = datetime.now(UTC)
    db.commit()
    return project


def list_project_members(db: Session, project_id: uuid.UUID) -> list[Member]:
    """專案的成員（含每個人在專案中的角色與技術特徵），先加入的在前"""
    from app.services import members

    rows = db.execute(
        select(MemberRow, ProjectMemberRow)
        .join(ProjectMemberRow, ProjectMemberRow.member_id == MemberRow.id)
        .where(ProjectMemberRow.project_id == project_id)
        .order_by(ProjectMemberRow.joined_at)
    ).all()
    return [members.to_schema(m, pm) for m, pm in rows]


def update_project_member(db: Session, project_id: uuid.UUID, member_id: str, patch: UpdateMemberInput) -> Member:
    """Leader 修改成員在專案中的設定：角色、職稱、專長、技術標籤、容量。姓名與 email 是成員自己的帳號資料，這裡不修改"""
    from app.services import members

    target = parse_uuid(member_id)
    row = db.execute(
        select(MemberRow, ProjectMemberRow)
        .join(ProjectMemberRow, ProjectMemberRow.member_id == MemberRow.id)
        .where(ProjectMemberRow.project_id == project_id, ProjectMemberRow.member_id == target)
    ).first()
    if row is None:
        raise ApiError("找不到這位成員", status=404, code="NOT_FOUND")
    member, pm = row

    if patch.role is not None and patch.role != pm.role:
        others = db.scalars(
            select(ProjectMemberRow).where(
                ProjectMemberRow.project_id == project_id,
                ProjectMemberRow.member_id != pm.member_id,
                ProjectMemberRow.role == "Leader",
            )
        ).all()
        if patch.role == "Leader":
            # 一個專案只有一位 Leader：原本的 Leader 改為 Member
            for other in others:
                other.role = "Member"
        elif not others:
            raise ApiError("專案至少要有一位 Leader，請先把另一位成員設為 Leader", status=422, code="VALIDATION_ERROR")
        pm.role = patch.role
    if patch.title is not None:
        pm.title = patch.title.strip()
    if patch.domain is not None:
        pm.domain = patch.domain
    if patch.tags is not None:
        pm.tags = [t.strip() for t in patch.tags if t.strip()]
    if patch.capacity is not None:
        pm.capacity = max(1, patch.capacity)
    db.commit()
    return members.to_schema(member, pm)


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
