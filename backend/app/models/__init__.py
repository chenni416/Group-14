"""所有資料表都要在這裡匯入，Alembic autogenerate 才找得到"""

from app.models.base import Base

__all__ = ["Base"]
