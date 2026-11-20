"""組織與專案 API，對應前端 contracts.ts 的 workspace。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/workspace.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.core.errors import not_implemented
from app.schemas.project import Organization, Project, UpdateProjectInput

router = APIRouter(tags=["組織與專案"])


@router.get(
    "/organization", operation_id="workspace.getOrganization", summary="目前的組織", response_model=Organization
)
async def get_organization() -> Organization:
    raise not_implemented("workspace.getOrganization")


@router.get("/project", operation_id="workspace.getProject", summary="目前的專案", response_model=Project)
async def get_project() -> Project:
    raise not_implemented("workspace.getProject")


@router.patch("/project", operation_id="workspace.updateProject", summary="修改專案設定", response_model=Project)
async def update_project(body: UpdateProjectInput) -> Project:
    raise not_implemented("workspace.updateProject")
