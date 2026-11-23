"""架構層級的測試：API 可以啟動、規格與前端一致、錯誤格式正確"""

import re
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
FRONTEND_HTTP = Path(__file__).resolve().parents[2] / "frontend/src/services/http/index.ts"


def test_health() -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_not_implemented_uses_error_format() -> None:
    res = client.get("/api/issues")  # 規劃流程以外的端點仍未實作
    assert res.status_code == 501
    assert res.json() == {"code": "NOT_IMPLEMENTED", "message": "issues.list 尚未實作"}


def test_validation_error_uses_error_format() -> None:
    res = client.post("/api/tasks/S-221/negotiate", json={})
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"


def _normalize(path: str) -> str:
    return re.sub(r"\{[^}]+\}", "{}", path)


def test_every_frontend_endpoint_exists() -> None:
    """frontend/src/services/http/index.ts 呼叫的每個端點，後端都要有相同的方法與路徑"""
    source = FRONTEND_HTTP.read_text(encoding="utf-8")
    calls = re.findall(r"http\.(get|post|put|patch|delete)\(\s*[`'\"]([^`'\"]+)[`'\"]", source)
    assert calls, "沒有讀到前端的 API 呼叫"
    frontend = {(verb.upper(), _normalize("/api" + re.sub(r"\$\{[^}]+\}", "{x}", path))) for verb, path in calls}
    backend = {
        (method, _normalize(path))
        for path, item in app.openapi()["paths"].items()
        for method in (m.upper() for m in item)
    }
    missing = sorted(frontend - backend)
    assert not missing, f"後端缺少這些端點：{missing}"
