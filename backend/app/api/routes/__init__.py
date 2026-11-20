"""所有 API 路由，依前端 contracts.ts 的服務分檔"""

from fastapi import APIRouter

from app.api.routes import (
    acceptance,
    auth,
    comments,
    docs,
    execution,
    issues,
    members,
    notifications,
    planning,
    proposals,
    retros,
    sprints,
    studio,
    tasks,
    workspace,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(members.router)
api_router.include_router(workspace.router)
api_router.include_router(docs.router)
api_router.include_router(sprints.router)
api_router.include_router(tasks.router)
api_router.include_router(planning.router)
api_router.include_router(notifications.router)
api_router.include_router(studio.router)
api_router.include_router(execution.router)
api_router.include_router(comments.router)
api_router.include_router(issues.router)
api_router.include_router(proposals.router)
api_router.include_router(acceptance.router)
api_router.include_router(retros.router)
