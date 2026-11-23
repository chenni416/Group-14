"""跨模組資料來源（FastAPI 依賴）。資料來自 app/repo 的資料層，目前為記憶體版假資料。"""

from typing import Annotated

from fastapi import Depends

from app.repo import Store
from app.schemas.member import Member


def get_members(store: Store) -> list[Member]:
    """目前專案的成員；有規劃中的 Sprint 時，capacity 為該 Sprint 設定的點數"""
    if store.planning_sprint_id is not None:
        return store.members_for(store.planning_sprint())
    return store.members


Members = Annotated[list[Member], Depends(get_members)]
