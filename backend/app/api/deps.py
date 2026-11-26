"""路由共用的 FastAPI 依賴。路由檔一律從這裡 import，不要各自重複定義。

- `Db`：每個請求一個資料庫 session（請求結束時關閉）
- `ProjectStore`：任務、規劃、派工、審查用的專案資料（`MemoryStore`）。GitHub 登入的成員：請求開始時從資料庫載入
  目前專案的資料，請求成功結束時把有變動的部分寫回（見 `repo/db_store.py`）；示範成員（X-Demo-User）用記憶體版
- `ProjectId`：前端目前選擇的專案（`X-Project-Id` 標頭）。
  沒有帶：使用最近加入的專案；有帶但格式錯誤：400 `INVALID_PROJECT_ID`；有帶但專案不存在或不是成員：
  403 `PROJECT_ACCESS_DENIED`。不會偷偷改用別的專案（見 `services.projects.current_membership`）。
  帳號層級的端點（/me、專案清單、邀請、通知）用 `AccountMember`，不檢查這個標頭
"""

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.auth import CurrentMember
from app.db.session import get_db
from app.repo import MemoryStore, Store, db_store
from app.services import projects

Db = Annotated[Session, Depends(get_db)]

ProjectId = Annotated[str | None, Header(alias="X-Project-Id")]


def get_project_store(
    request: Request, me: CurrentMember, demo: Store, db: Db, project_id: ProjectId = None
) -> Iterator[MemoryStore]:
    member_id = projects.parse_uuid(me.id)
    if member_id is None:
        yield demo
        return
    current = projects.require_current_project_id(db, member_id, project_id)
    # 會修改資料的請求鎖住專案，同一專案的修改依序進行
    store, snapshot = db_store.load(db, current, lock=request.method not in ("GET", "HEAD"))
    yield store
    # 只有處理成功才會執行到這裡（處理中發生錯誤時，例外會在 yield 拋出，不會寫回）
    db_store.save(db, store, snapshot)
    db.commit()


ProjectStore = Annotated[MemoryStore, Depends(get_project_store, scope="function")]
