"""FastAPI 進入點：`uv run uvicorn app.main:app --reload`"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.ai import audit, audit_view
from app.api.routes import api_router
from app.core.config import get_settings
from app.core.errors import register_error_handlers

LOCAL_ORIGIN = r"http://(localhost|127\.0\.0\.1)(:\d+)?"


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
        # 開發環境放行本機的任何埠（Vite 在 5173 被占用時會自動換埠，用 127.0.0.1 打開網頁也算不同網址）
        allow_origin_regex=LOCAL_ORIGIN if settings.app_env == "development" else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(audit.AuditMiddleware)  # AI 呼叫稽核紀錄（app/ai/audit.py）
    register_error_handlers(app)

    @app.get(f"{settings.api_prefix}/health", tags=["系統"], operation_id="system.health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.app_env}

    if settings.app_env == "development":

        @app.get(
            f"{settings.api_prefix}/dev/ai-logs",
            tags=["系統"],
            operation_id="system.aiLogs",
            summary="開發用：最近的 AI 呼叫紀錄（新的在前）",
        )
        async def ai_logs(limit: int = 20) -> list[dict]:
            return audit.read_recent(min(max(limit, 1), 200))

        @app.get(
            f"{settings.api_prefix}/dev/ai-logs/view",
            tags=["系統"],
            operation_id="system.aiLogsView",
            summary="開發用：最近的 AI 呼叫紀錄（網頁版，方便閱讀）",
            response_class=HTMLResponse,
        )
        async def ai_logs_view(limit: int = 20) -> HTMLResponse:
            return HTMLResponse(audit_view.render_html(audit.read_recent(min(max(limit, 1), 200))))

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
