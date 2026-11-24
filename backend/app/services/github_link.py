"""專案連結 GitHub repo（規格見 docs/github.md 第 1 節 ④、3.2、3.5）。

流程：
1. Leader 在建立專案或團隊設定按「連結」→ start_link 產生帶簽章 state 的 GitHub App 安裝網址
2. GitHub 安裝完成後回到前端 /github/callback → complete_link：
   - 驗證 state（同一位 Leader、同一個專案、未過期）
   - 用使用者授權碼查詢「登入者可以存取的安裝」，確認 installation_id 不是偽造的
   - 記錄安裝，並在授權的 repo 中找到專案填寫的 repo → 綁定
   - 送出安裝請求（不是 repo 擁有者）時標示為等待核准
   - 安裝沒有包含填寫的 repo 時，回傳授權的 repo 讓 Leader 選擇（choose_repository）
3. 一個 repo 只能綁一個專案（projects.github_repo_id 唯一）
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.integrations.github import client
from app.integrations.github.state import sign_state, verify_state
from app.models import GithubInstallation as InstallationRow
from app.models import Project as ProjectRow
from app.models import ProjectMember as ProjectMemberRow
from app.schemas.github import CompleteInstallationInput, GithubRepository, LinkResult
from app.services.projects import current_membership


def _now() -> datetime:
    return datetime.now(UTC)


def _leader_project(db: Session, member_id: uuid.UUID, project_id: uuid.UUID) -> ProjectRow:
    row = db.execute(
        select(ProjectRow, ProjectMemberRow)
        .join(ProjectMemberRow, ProjectMemberRow.project_id == ProjectRow.id)
        .where(ProjectRow.id == project_id, ProjectMemberRow.member_id == member_id)
    ).first()
    if row is None:
        raise ApiError("找不到這個專案", status=404, code="NOT_FOUND")
    project, membership = row
    if membership.role != "Leader":
        raise ApiError("只有 Leader 可以連結 GitHub repo", status=403, code="FORBIDDEN")
    if not project.git_integration:
        raise ApiError("這個專案沒有開啟 Git 整合", status=422, code="GIT_INTEGRATION_OFF")
    return project


def _current_leader_project(db: Session, member_id: uuid.UUID, project_id: str | None) -> ProjectRow:
    current = current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return _leader_project(db, member_id, current[0].id)


def start_link(db: Session, member_id: uuid.UUID, project_id: str | None) -> str:
    """產生 GitHub App 安裝網址"""
    project = _current_leader_project(db, member_id, project_id)
    return client.install_url(sign_state(project.id, member_id))


def _save_installation(db: Session, inst: client.Installation, member_id: uuid.UUID) -> None:
    row = db.get(InstallationRow, inst.id)
    if row is None:
        row = InstallationRow(installation_id=inst.id, installed_by_member_id=member_id)
        db.add(row)
    row.account_id = inst.account_id
    row.account_login = inst.account_login
    row.account_type = inst.account_type
    row.account_avatar_url = inst.account_avatar_url
    row.repository_selection = inst.repository_selection
    row.status = "active"
    row.deleted_at = None
    row.updated_at = _now()


def _bind(
    db: Session, project: ProjectRow, member_id: uuid.UUID, installation_id: int, repo: client.Repository
) -> None:
    taken = db.scalar(select(ProjectRow).where(ProjectRow.github_repo_id == repo.id, ProjectRow.id != project.id))
    if taken is not None:
        raise ApiError(f"{repo.full_name} 已經連結到其他專案", status=409, code="REPO_ALREADY_LINKED")
    project.github_installation_id = installation_id
    project.github_repo_id = repo.id
    project.github_repo_full_name = repo.full_name
    project.github_repo_url = repo.html_url
    project.github_default_branch = repo.default_branch
    project.github_repo_private = repo.private
    project.github_link_status = "linked"
    project.github_linked_by_member_id = member_id
    project.github_linked_at = _now()
    project.github_sync_error = None
    project.updated_at = _now()


def _repo_schema(repo: client.Repository) -> GithubRepository:
    return GithubRepository(id=repo.id, full_name=repo.full_name, html_url=repo.html_url, private=repo.private)


def complete_link(db: Session, member_id: uuid.UUID, body: CompleteInstallationInput) -> LinkResult:
    project_id, state_member = verify_state(body.state)
    if state_member != member_id:
        raise ApiError("這個連結不是由你發起的，請重新開始", status=403, code="INVALID_STATE")
    project = _leader_project(db, member_id, project_id)

    # 不是 repo 擁有者：GitHub 只送出安裝請求，要等擁有者核准
    if body.setup_action == "request" or body.installation_id is None:
        project.github_link_status = "pending"
        project.updated_at = _now()
        db.commit()
        return LinkResult(status="pending", repo_full_name=project.github_repo_full_name)

    if not body.code:
        raise ApiError("GitHub 沒有回傳授權資訊，請重新連結", status=400, code="GITHUB_AUTH_FAILED")
    # 確認這個安裝是登入者可以存取的，防止貼上別人的 installation_id
    if body.installation_id not in client.user_installation_ids(client.exchange_user_code(body.code)):
        raise ApiError("無法確認這個 GitHub App 安裝屬於你，請重新連結", status=403, code="INSTALLATION_NOT_YOURS")

    _save_installation(db, client.get_installation(body.installation_id), member_id)
    project.github_installation_id = body.installation_id
    repos = client.list_installation_repositories(body.installation_id)
    wanted = (project.github_repo_full_name or "").lower()
    match = next((r for r in repos if r.full_name.lower() == wanted), None)
    if match is None:
        # 安裝時沒有勾選填寫的 repo（或填錯）：讓 Leader 從授權的 repo 中選擇
        project.github_link_status = "none"
        db.commit()
        return LinkResult(
            status="choose_repo",
            repo_full_name=project.github_repo_full_name,
            repositories=[_repo_schema(r) for r in repos],
        )
    _bind(db, project, member_id, body.installation_id, match)
    db.commit()
    return LinkResult(status="linked", repo_full_name=match.full_name)


def choose_repository(db: Session, member_id: uuid.UUID, project_id: str | None, repo_full_name: str) -> LinkResult:
    """從專案已安裝的 GitHub App 授權的 repo 中選擇一個綁定"""
    project = _current_leader_project(db, member_id, project_id)
    if project.github_installation_id is None:
        raise ApiError("請先安裝 GitHub App", status=422, code="NOT_INSTALLED")
    repos = client.list_installation_repositories(project.github_installation_id)
    match = next((r for r in repos if r.full_name.lower() == repo_full_name.strip().lower()), None)
    if match is None:
        raise ApiError("GitHub App 沒有被授權存取這個 repo", status=422, code="REPO_NOT_AUTHORIZED")
    _bind(db, project, member_id, project.github_installation_id, match)
    db.commit()
    return LinkResult(status="linked", repo_full_name=match.full_name)


def unlink(db: Session, member_id: uuid.UUID, project_id: str | None) -> None:
    """解除連結：保留填寫過的 repo 網址，方便重新連結；GitHub 上的 App 安裝不受影響"""
    current = current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    project, membership = current
    if membership.role != "Leader":
        raise ApiError("只有 Leader 可以解除連結", status=403, code="FORBIDDEN")
    project.github_installation_id = None
    project.github_repo_id = None
    project.github_link_status = "none"
    project.github_linked_by_member_id = None
    project.github_linked_at = None
    project.updated_at = _now()
    db.commit()
