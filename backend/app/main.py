"""FastAPI 進入點：`uv run uvicorn app.main:app --reload`"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Taskline API",
        version="0.1.0",
        description="前端 frontend/src/services/contracts.ts 對應的後端 API。尚未實作的端點回傳 501。",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)

    @app.get(f"{settings.api_prefix}/health", tags=["系統"], operation_id="system.health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.app_env}

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
