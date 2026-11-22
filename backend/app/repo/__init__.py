"""資料層。目前是記憶體版假資料（memory.py），之後換成資料庫"""

from app.repo.memory import MemoryStore, Store, get_store

__all__ = ["MemoryStore", "Store", "get_store"]
