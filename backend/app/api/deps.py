"""路由共用的 FastAPI 依賴。路由檔一律從這裡 import，不要各自重複定義。

- `Db`：每個請求一個資料庫 session（請求結束時關閉）
- `ProjectId`：前端目前選擇的專案（`X-Project-Id` 標頭）。沒有帶、無效或不是成員時，
  `services.projects.current_membership` 會改用最近加入的專案，並在日誌留下 warning（`project fallback`）
"""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db.session import get_db

Db = Annotated[Session, Depends(get_db)]

ProjectId = Annotated[str | None, Header(alias="X-Project-Id")]
