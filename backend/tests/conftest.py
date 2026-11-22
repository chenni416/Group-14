import pytest

from app.main import app
from app.repo import get_store
from app.repo.seed import build_seed


@pytest.fixture(autouse=True)
def store():
    """每個測試都用全新的假資料，互不影響"""
    fresh = build_seed()
    app.dependency_overrides[get_store] = lambda: fresh
    yield fresh
    app.dependency_overrides.pop(get_store, None)
