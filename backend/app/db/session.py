"""資料庫連線。engine 在第一次使用時才建立，沒有資料庫也能啟動 API（例如只看 /docs）"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url, pool_pre_ping=True)


@lru_cache
def get_sessionmaker() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency：每個請求一個 session，結束時關閉"""
    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()
