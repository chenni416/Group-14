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


def _preflight(origin: str):
    return client.options(
        "/api/planning/drafts",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )


def test_dev_allows_any_local_port_but_not_other_hosts() -> None:
    """Vite 換埠或用 127.0.0.1 打開網頁時，開發環境不該被 CORS 擋住；其他主機仍要明確列在 CORS_ORIGINS"""
    for origin in ("http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:3000"):
        res = _preflight(origin)
        assert res.status_code == 200 and res.headers["access-control-allow-origin"] == origin
    for origin in ("http://192.168.1.5:5173", "https://evil.example.com", "http://localhost.evil.com"):
        assert _preflight(origin).status_code == 400


def test_production_only_allows_listed_origins(monkeypatch) -> None:
    """放行任意本機埠只限開發環境；正式環境一律只認 CORS_ORIGINS 裡列出的網址"""
    from app import main
    from app.core.config import Settings

    monkeypatch.setattr(main, "get_settings", lambda: Settings(app_env="production"))
    prod = TestClient(main.create_app())
    headers = {"Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}
    listed = prod.options("/api/planning/drafts", headers={**headers, "Origin": "http://localhost:5173"})
    other = prod.options("/api/planning/drafts", headers={**headers, "Origin": "http://localhost:5174"})
    assert listed.status_code == 200
    assert other.status_code == 400
