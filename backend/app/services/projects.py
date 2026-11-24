"""專案：projects、project_members 資料表的讀寫（GitHub 登入的成員使用）。

- 一個成員可以參與多個專案；前端以 X-Project-Id 標頭指定目前的專案，沒有指定時使用最近加入的專案
- 建立專案的人自動成為 Leader
- 開發用的示範成員（X-Demo-User）不經過這裡，繼續使用 MemoryStore
"""

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Member as MemberRow
from app.models import Project as ProjectRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.member import Member, UpdateMemberInput
from app.schemas.project import (
    CreateProjectInput,
    Organization,
    Project,
    ProjectSummary,
    ReviewPolicy,
    Team,
    UpdateProjectInput,
)

DEFAULT_BRANCH_PATTERN = "{類型}/S{Sprint}{Story}{Task}-{摘要}"
DEFAULT_SPRINT_LENGTH = "2 週"
# Sprint 長度：數字加單位；7 天以上用週表示，超過 4 週就失去短週期迭代的意義
SPRINT_LENGTH_RANGES = {"天": (1, 6), "週": (1, 4)}
SPRINT_LENGTH_PATTERN = re.compile(r"^(\d+) (天|週)$")


def normalize_sprint_length(value: str) -> str:
    """檢查 Sprint 長度（例如 5 天、2 週）；格式或範圍不符時回傳 422"""
    match = SPRINT_LENGTH_PATTERN.match(value.strip())
    if match:
        count, unit = int(match.group(1)), match.group(2)
        low, high = SPRINT_LENGTH_RANGES[unit]
        if low <= count <= high:
            return f"{count} {unit}"
    raise ApiError("Sprint 長度可以是 1–6 天或 1–4 週", status=422, code="VALIDATION_ERROR")


# GitHub repo：https://github.com/owner/name、github.com/owner/name 或 owner/name（可帶 .git）
REPO_PATTERN = re.compile(
    r"^(?:(?:https?://)?(?:www\.)?github\.com/)?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/([A-Za-z0-9._-]+?)(?:\.git)?/?$"
)


def parse_repo(text: str) -> str:
    """把使用者輸入的 repo 轉成 owner/name；格式不符時回傳 422"""
    match = REPO_PATTERN.match(text.strip())
    if not match or match.group(2) in (".", ".."):
        raise ApiError("請輸入 GitHub repo，例如 https://github.com/owner/repo", status=422, code="VALIDATION_ERROR")
    return f"{match.group(1)}/{match.group(2)}"


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

    sprint_length = normalize_sprint_length(body.sprint_length) if body.sprint_length else DEFAULT_SPRINT_LENGTH
    repo = parse_repo(body.repo) if body.repo and body.repo.strip() else None
    if body.git_integration and repo is None:
        raise ApiError("整合 GitHub 時請填寫 repo", status=422, code="VALIDATION_ERROR")

    project = ProjectRow(
        name=name,
        prefix=prefix,
        goal=body.goal.strip(),
        sprint_length=sprint_length,
        git_integration=body.git_integration,
        # 先記錄填寫的 repo；整合時由 GitHub App 安裝流程驗證權限後才標示為已連結
        github_repo_full_name=repo,
        github_repo_url=f"https://github.com/{repo}" if repo else None,
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
    """修改專案設定：只改前端有傳的欄位。

    repo：尚未連結時可以修改（空字串表示清除）；已連結時要先解除連結才能更換。
    """
    if patch.repo is not None:
        if project.github_link_status == "linked":
            raise ApiError("repo 已經連結，要更換請先解除連結", status=409, code="REPO_LINKED")
        repo = parse_repo(patch.repo) if patch.repo.strip() else None
        if repo != project.github_repo_full_name:
            project.github_repo_full_name = repo
            project.github_repo_url = f"https://github.com/{repo}" if repo else None
            # 原本的安裝請求是針對舊的 repo，改回尚未連結
            project.github_repo_id = None
            project.github_link_status = "none"
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
        project.sprint_length = normalize_sprint_length(patch.sprint_length)
    if patch.default_policy is not None:
        project.default_policy = patch.default_policy.model_dump()
    if patch.git_integration is not None:
        project.git_integration = patch.git_integration
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


def delete_project(db: Session, member_id: uuid.UUID, project_id: str | None, confirm_name: str) -> None:
    """Leader 刪除專案；相關的成員關係、文件、Sprint、任務、GitHub 資料由資料庫一併刪除（ON DELETE CASCADE）。

    刪除一定要明確指定專案（X-Project-Id），不會改用「最近加入的專案」，避免刪錯。
    """
    target = parse_uuid(project_id)
    row = (
        db.execute(
            select(ProjectRow, ProjectMemberRow)
            .join(ProjectMemberRow, ProjectMemberRow.project_id == ProjectRow.id)
            .where(ProjectRow.id == target, ProjectMemberRow.member_id == member_id)
        ).first()
        if target is not None
        else None
    )
    if row is None:
        raise ApiError("找不到這個專案", status=404, code="NOT_FOUND")
    project, membership = row
    if membership.role != "Leader":
        raise ApiError("只有 Leader 可以刪除專案", status=403, code="FORBIDDEN")
    if confirm_name.strip() != project.name:
        raise ApiError("輸入的專案名稱不符，沒有刪除", status=422, code="CONFIRM_MISMATCH")
    db.execute(delete(ProjectRow).where(ProjectRow.id == project.id))
    db.commit()


def remove_project_member(db: Session, project_id: uuid.UUID, actor_id: uuid.UUID, member_id: str) -> None:
    """Leader 把成員移出專案：只刪除專案內的成員關係，成員的帳號不受影響，之後可以再邀請回來"""
    target = parse_uuid(member_id)
    pm = db.scalar(
        select(ProjectMemberRow).where(ProjectMemberRow.project_id == project_id, ProjectMemberRow.member_id == target)
    )
    if pm is None:
        raise ApiError("找不到這位成員", status=404, code="NOT_FOUND")
    if pm.member_id == actor_id:
        raise ApiError("不能把自己移出專案", status=422, code="VALIDATION_ERROR")
    if pm.role == "Leader":
        raise ApiError("不能移除 Leader，請先把 Leader 轉給其他成員", status=422, code="VALIDATION_ERROR")
    db.delete(pm)
    db.commit()


def organization_of(db: Session, project: ProjectRow) -> Organization:
    """組織還沒有資料表：先以目前的專案當作組織與唯一的團隊"""
    count = len(db.scalars(select(ProjectMemberRow).where(ProjectMemberRow.project_id == project.id)).all())
    return Organization(
        name=project.name,
        slug=project.prefix.lower(),
        plan="Free",
        teams=[Team(name=project.name, member_count=count, current=True)],
    )


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
        git_integration=row.git_integration,
        github_link_status=row.github_link_status,
        github_repo_url=row.github_repo_url or "",
        active_sprint_id=0,
        planning_sprint_id=None,
    )
