"""跨模組資料來源（FastAPI 依賴）。資料來自目前專案的 ProjectStore（資料庫載入；示範成員為記憶體版）。"""

from typing import Annotated

from fastapi import Depends

from app.api.deps import ProjectStore
from app.schemas.member import Member


def get_members(store: ProjectStore) -> list[Member]:
    """目前專案的成員；有規劃中的 Sprint 時，capacity 為該 Sprint 設定的點數"""
    if store.planning_sprint_id is not None:
        return store.members_for(store.planning_sprint())
    return store.members


Members = Annotated[list[Member], Depends(get_members)]
