"""資料庫連線。engine 在第一次使用時才建立，沒有資料庫也能啟動 API（例如只看 /docs）"""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    # 團隊共用 Supabase 免費版，資料庫連線只有 15 條，要經過 Transaction pooler（port 6543）共用：
    # - NullPool：後端不保留閒置連線，請求結束就歸還，由 Supabase 的 pooler 負責共用
    #   （SQLAlchemy 預設每個後端最多會佔 15 條，幾個人同時開後端就會佔滿）
    # - prepare_threshold=None：關閉 psycopg 自動建立 prepared statement。Transaction pooler 每次交易
    #   可能分到不同的資料庫連線，留著會隨機出現「prepared statement "_pg3_0" does not exist」
    return create_engine(
        get_settings().database_url,
        poolclass=NullPool,
        connect_args={"prepare_threshold": None},
    )


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
