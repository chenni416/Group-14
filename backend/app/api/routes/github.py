"""GitHub repo 連結 API（Leader 限定；流程見 app/services/github_link.py）"""

from fastapi import APIRouter

from app.api.deps import Db, ProjectId
from app.core.auth import CurrentMember
from app.core.errors import ApiError
from app.schemas.github import ChooseRepositoryInput, CompleteInstallationInput, InstallUrl, LinkResult
from app.services import github_link, projects

router = APIRouter(tags=["GitHub 整合"])


def _member_id(me: CurrentMember):
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        raise ApiError("示範資料無法連結 GitHub，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    return member_id


@router.get(
    "/github/install-url", operation_id="github.installUrl", summary="GitHub App 安裝網址", response_model=InstallUrl
)
def install_url(me: CurrentMember, db: Db, project_id: ProjectId = None) -> InstallUrl:
    return InstallUrl(url=github_link.start_link(db, _member_id(me), project_id))


@router.post(
    "/github/installations",
    operation_id="github.completeInstallation",
    summary="GitHub App 安裝完成：驗證並綁定 repo",
    response_model=LinkResult,
)
def complete_installation(body: CompleteInstallationInput, me: CurrentMember, db: Db) -> LinkResult:
    return github_link.complete_link(db, _member_id(me), body)


@router.put(
    "/github/repository",
    operation_id="github.chooseRepository",
    summary="從授權的 repo 中選擇要連結的",
    response_model=LinkResult,
)
def choose_repository(
    body: ChooseRepositoryInput, me: CurrentMember, db: Db, project_id: ProjectId = None
) -> LinkResult:
    return github_link.choose_repository(db, _member_id(me), project_id, body.repo_full_name)


@router.delete("/github/repository", operation_id="github.unlink", summary="解除 repo 連結", status_code=204)
def unlink(me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    github_link.unlink(db, _member_id(me), project_id)
