"""組織與專案 API，對應前端 contracts.ts 的 workspace。

- GitHub 登入的成員：讀寫 projects、project_members 資料表（app/services/projects.py）
- 開發用的示範成員（X-Demo-User）：沿用記憶體版假資料（MemoryStore），自動測試與示範不需要資料庫

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts
"""

from fastapi import APIRouter

from app.api.deps import Db, ProjectId
from app.core.auth import CurrentMember, require_leader
from app.core.errors import ApiError
from app.repo import Store
from app.schemas.project import (
    CreateProjectInput,
    DeleteProjectInput,
    Organization,
    Project,
    ProjectSummary,
    UpdateProjectInput,
)
from app.services import projects, workspace_flow

router = APIRouter(tags=["組織與專案"])


@router.get(
    "/organization", operation_id="workspace.getOrganization", summary="目前的組織", response_model=Organization
)
def get_organization(me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> Organization:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        assert store.org is not None
        return store.org
    current = projects.current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return projects.organization_of(db, current[0])


@router.get(
    "/projects", operation_id="workspace.listProjects", summary="我參與的專案", response_model=list[ProjectSummary]
)
def list_projects(me: CurrentMember, store: Store, db: Db) -> list[ProjectSummary]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        # 示範成員：只有一個假專案
        p = store.current_project()
        return [ProjectSummary(id="taskline", name=p.name, prefix=p.prefix, role=me.role)]
    return projects.list_my_projects(db, member_id)


@router.post("/projects", operation_id="workspace.createProject", summary="建立專案", response_model=ProjectSummary)
def create_project(body: CreateProjectInput, me: CurrentMember, db: Db) -> ProjectSummary:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        raise ApiError("示範身分無法建立專案，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    return projects.create_project(db, member_id, body)


@router.get("/project", operation_id="workspace.getProject", summary="目前的專案", response_model=Project)
def get_project(me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None) -> Project:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return store.current_project()
    current = projects.current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return projects.to_schema(current[0])


@router.patch("/project", operation_id="workspace.updateProject", summary="修改專案設定", response_model=Project)
def update_project(
    body: UpdateProjectInput, me: CurrentMember, store: Store, db: Db, project_id: ProjectId = None
) -> Project:
    require_leader(me)
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        return workspace_flow.update_project(store, body)
    current = projects.current_membership(db, member_id, project_id)
    if current is None:
        raise ApiError("還沒有專案，請先建立專案", status=404, code="NO_PROJECT")
    return projects.to_schema(projects.update_project(db, current[0], body))


@router.delete("/project", operation_id="workspace.deleteProject", summary="刪除目前的專案（Leader）", status_code=204)
def delete_project(body: DeleteProjectInput, me: CurrentMember, db: Db, project_id: ProjectId = None) -> None:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        raise ApiError("示範資料無法刪除專案，請以 GitHub 登入", status=400, code="NOT_A_GITHUB_MEMBER")
    projects.delete_project(db, member_id, project_id, body.confirm_name)
