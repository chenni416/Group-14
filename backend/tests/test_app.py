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


def _preflight(test_client: TestClient, origin: str) -> int:
    res = test_client.options("/api/health", headers={"Origin": origin, "Access-Control-Request-Method": "GET"})
    return res.status_code


def test_cors_allows_any_local_port_in_development() -> None:
    for origin in ("http://localhost:5173", "http://localhost:5180", "http://127.0.0.1:3000", "http://localhost"):
        assert _preflight(client, origin) == 200, origin


def test_cors_rejects_non_local_origin_in_development() -> None:
    for origin in ("http://evil.example.com", "http://localhost.evil.com:5173", "https://localhost:5173"):
        assert _preflight(client, origin) == 400, origin


def test_cors_production_only_allows_listed_origins(monkeypatch) -> None:
    from app.core.config import get_settings

    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()
    try:
        from app.main import create_app

        prod = TestClient(create_app())
        assert _preflight(prod, "http://localhost:5173") == 200  # 清單內
        assert _preflight(prod, "http://localhost:5180") == 400  # 清單外的本機 port 不放行
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()


def test_not_implemented_uses_error_format() -> None:
    res = client.get("/api/retros")  # 規劃流程以外的端點仍未實作
    assert res.status_code == 501
    assert res.json() == {"code": "NOT_IMPLEMENTED", "message": "retros.list 尚未實作"}


def test_validation_error_uses_error_format() -> None:
    res = client.post("/api/tasks/S-221/negotiate", json={}, headers={"X-Demo-User": "m3"})
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
