"""SQLAlchemy 資料表的共同基底。

新增資料表時：
1. 在 app/models/ 建立對應檔案，繼承 Base
2. 在 app/models/__init__.py 匯入，讓 Alembic 偵測得到
3. 執行 `uv run alembic revision --autogenerate -m "說明"` 產生遷移檔
"""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# 固定索引與約束的命名規則，遷移檔才會穩定、可比對
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
