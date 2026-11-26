"""資料層。

- memory.py：記憶體版（示範成員 X-Demo-User 用，重新啟動就回到種子資料）
- db_store.py：把一個專案的資料庫資料載入成 MemoryStore、請求結束時寫回（GitHub 登入的成員用）
"""

from app.repo import db_store
from app.repo.memory import MemoryStore, Store, get_store

__all__ = ["MemoryStore", "Store", "db_store", "get_store"]
