"""request id middleware：回應標頭、沿用前端帶的 id、未預期例外的 500 JSON"""

import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.observability import RequestIdMiddleware, current_request_id
from app.main import create_app


def _app() -> TestClient:
    app = FastAPI()
    app.add_middleware(RequestIdMiddleware)

    @app.get("/ok")
    def ok() -> dict[str, str | None]:
        return {"rid": current_request_id()}

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    return TestClient(app, raise_server_exceptions=False)


def test_generates_request_id_and_exposes_it_to_handlers() -> None:
    res = _app().get("/ok")
    rid = res.headers["x-request-id"]
    assert len(rid) == 12
    assert res.json() == {"rid": rid}


def test_reuses_valid_incoming_id() -> None:
    res = _app().get("/ok", headers={"X-Request-Id": "web-abc_123"})
    assert res.headers["x-request-id"] == "web-abc_123"


@pytest.mark.parametrize("bad", ["has space", "x" * 65, "a/b", "a;b"])
def test_replaces_invalid_incoming_id(bad: str) -> None:
    res = _app().get("/ok", headers={"X-Request-Id": bad})
    assert res.headers["x-request-id"] != bad
    assert len(res.headers["x-request-id"]) == 12


def test_unhandled_exception_returns_json_without_leaking_details(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="app.request"):
        res = _app().get("/boom", headers={"X-Request-Id": "rid-1"})
    assert res.status_code == 500
    assert res.headers["x-request-id"] == "rid-1"
    body = res.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert "rid-1" in body["message"]
    assert "secret internal detail" not in res.text
    # 日誌有完整例外與同一個 request id，才能從錯誤代碼找到原因
    assert any("rid=rid-1" in r.getMessage() and r.exc_info for r in caplog.records)


def test_unhandled_500_has_cors_headers_so_browser_can_read_it() -> None:
    """用真正的 app（含 middleware 順序）：前端在別的 origin，500 回應沒有 CORS 標頭會被瀏覽器擋掉，
    前端只會看到 NETWORK_ERROR，讀不到錯誤代碼與 X-Request-Id"""
    app = create_app()

    @app.get("/api/_boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    origin = get_settings().cors_origins[0]
    res = TestClient(app, raise_server_exceptions=False).get("/api/_boom", headers={"Origin": origin})
    assert res.status_code == 500
    assert res.json()["code"] == "INTERNAL_ERROR"
    assert res.headers["access-control-allow-origin"] == origin
    assert "x-request-id" in res.headers["access-control-expose-headers"].lower()
    assert res.headers["x-request-id"] in res.json()["message"]


def test_request_id_cleared_after_request() -> None:
    _app().get("/ok")
    assert current_request_id() is None
