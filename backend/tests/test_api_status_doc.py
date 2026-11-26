"""docs/api-status.md 由 scripts/route_status.py 產生；路由改了卻沒更新文件時，這個測試會失敗"""

import importlib.util
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent


def _load():
    spec = importlib.util.spec_from_file_location("route_status", BACKEND / "scripts" / "route_status.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_api_status_doc_is_up_to_date() -> None:
    module = _load()
    current = module.OUT.read_text(encoding="utf-8").replace("\r\n", "\n")
    assert current == module.render(module.collect()), "請執行：uv run python scripts/route_status.py"


def test_every_route_file_is_covered() -> None:
    """每個含路由的檔案都出現在狀態表，避免新增路由檔卻被腳本漏掉"""
    module = _load()
    groups = {r.group for r in module.collect()}
    files = {f.stem for f in module.ROUTES.glob("*.py") if f.name != "__init__.py"}
    assert groups == files
