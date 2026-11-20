"""統一的錯誤格式 {code, message}，與前端 services/http/client.ts 的解析方式一致"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, message: str, status: int = 400, code: str = "BAD_REQUEST") -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def not_implemented(operation: str) -> ApiError:
    """尚未實作的 API 一律回傳 501，operation 對應前端 contracts.ts 的「服務.方法」"""
    return ApiError(f"{operation} 尚未實作", status=501, code="NOT_IMPLEMENTED")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content={"code": exc.code, "message": exc.message})

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        message = f"欄位 {field} 格式錯誤：{first.get('msg', '')}" if field else "請求格式錯誤"
        return JSONResponse(status_code=422, content={"code": "VALIDATION_ERROR", "message": message})
