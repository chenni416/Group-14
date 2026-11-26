"""路由共用的 FastAPI 依賴。路由檔一律從這裡 import，不要各自重複定義。

- `Db`：每個請求一個資料庫 session（請求結束時關閉）
- `ProjectId`：前端目前選擇的專案（`X-Project-Id` 標頭）。
  沒有帶：使用最近加入的專案；有帶但格式錯誤：400 `INVALID_PROJECT_ID`；有帶但專案不存在或不是成員：
  403 `PROJECT_ACCESS_DENIED`。不會偷偷改用別的專案（見 `services.projects.current_membership`）。
  帳號層級的端點（/me、專案清單、邀請、通知）用 `AccountMember`，不檢查這個標頭
"""

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.db.session import get_db

Db = Annotated[Session, Depends(get_db)]

ProjectId = Annotated[str | None, Header(alias="X-Project-Id")]
