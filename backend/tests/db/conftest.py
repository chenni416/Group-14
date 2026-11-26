"""需要資料庫的測試：使用獨立的測試資料庫，絕不連到共用的 Supabase。

- 本機：docker-compose 的 Postgres（`docker compose up -d`，主機 port 5433），自動建立 taskline_test 資料庫
- CI：GitHub Actions 的 Postgres 服務（見 .github/workflows/ci.yml）
- 連線字串由 TEST_DATABASE_URL 指定；只接受本機或 CI 主機、且資料庫名稱以 _test 結尾
- 每次測試開始前清空並重新套用所有遷移（同時驗證遷移可以 upgrade／downgrade）
- 每個測試包在交易裡，結束時 rollback，測試之間互不影響
"""

import os
from collections.abc import Iterator

import pytest
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from alembic import command
from app.db.session import get_db
from app.main import app

LOCAL_PORT = os.environ.get("TASKLINE_DB_PORT", "5433")
# 用 127.0.0.1 而不是 localhost：Windows 會先試 IPv6（::1），每次連線要多等約 15 秒才退回 IPv4
DEFAULT_URL = f"postgresql+psycopg://taskline:taskline@127.0.0.1:{LOCAL_PORT}/taskline_test"
SAFE_HOSTS = {"localhost", "127.0.0.1", "postgres", "db"}
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _test_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL", DEFAULT_URL)
    parsed = make_url(url)
    if parsed.host not in SAFE_HOSTS or not (parsed.database or "").endswith("_test"):
        target = f"{parsed.host}/{parsed.database}"
        pytest.exit(
            f"TEST_DATABASE_URL 必須指向本機或 CI 的測試資料庫（名稱以 _test 結尾），目前是 {target}", returncode=2
        )
    return url


def _ensure_database(url: str) -> None:
    """測試資料庫不存在時自動建立（docker-compose 預設只有 taskline 資料庫）"""
    parsed = make_url(url)
    admin = create_engine(parsed.set(database="postgres"), isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as conn:
            exists = conn.scalar(text("select 1 from pg_database where datname = :n"), {"n": parsed.database})
            if not exists:
                conn.execute(text(f'create database "{parsed.database}"'))
    finally:
        admin.dispose()


def _alembic(url: str) -> Config:
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "alembic"))
    cfg.attributes["database_url"] = url
    return cfg


@pytest.fixture(scope="session")
def db_engine() -> Iterator[Engine]:
    url = _test_url()
    try:
        _ensure_database(url)
    except OperationalError:
        if os.environ.get("CI"):
            raise
        pytest.skip("需要本機的測試資料庫：開啟 Docker Desktop 後在 repo 根目錄執行 docker compose up -d")

    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("drop schema public cascade"))
        conn.execute(text("create schema public"))
    cfg = _alembic(url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def db(db_engine: Engine) -> Iterator[Session]:
    """包在交易裡的 session；程式中的 commit 只會變成 savepoint，測試結束時全部 rollback"""
    conn = db_engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
    app.dependency_overrides[get_db] = lambda: session
    yield session
    app.dependency_overrides.pop(get_db, None)
    session.close()
    trans.rollback()
    conn.close()
