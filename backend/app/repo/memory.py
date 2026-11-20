"""記憶體版資料層（假資料）。

資料表完成前，所有 AI 流程都讀寫這裡；重新啟動伺服器就會回到種子資料。
之後換成資料庫時，保留這個類別的方法簽名，把內部改成查詢資料庫即可，服務層與路由不用動。
"""

from dataclasses import dataclass, field
from typing import Annotated

from fastapi import Depends

from app.ai.context import DocSnippet
from app.core.errors import ApiError
from app.schemas.collab import ChatMessage, ExecutionPlan
from app.schemas.member import Member
from app.schemas.sprint import BacklogItem, Sprint
from app.schemas.task import Task


@dataclass
class PromptThread:
    """任務的 Living Prompt 版本紀錄與專案脈絡助理對話"""

    clarifications: list[list[str]] = field(default_factory=lambda: [[]])
    """每個版本累積的釐清結論；第 0 版為空（只有任務規格）"""
    cursor: int = 0
    chat: list[ChatMessage] = field(default_factory=list)


@dataclass
class MemoryStore:
    project_goal: str = ""
    members: list[Member] = field(default_factory=list)
    sprints: dict[int, Sprint] = field(default_factory=dict)
    tasks: dict[str, Task] = field(default_factory=dict)
    docs: list[DocSnippet] = field(default_factory=list)
    backlog: list[BacklogItem] = field(default_factory=list)
    plans: dict[str, ExecutionPlan] = field(default_factory=dict)
    threads: dict[str, PromptThread] = field(default_factory=dict)
    active_sprint_id: int = 0
    planning_sprint_id: int | None = None

    # ---------- 查詢 ----------

    def find_member(self, member_id: str) -> Member:
        for m in self.members:
            if m.id == member_id:
                return m
        raise ApiError("找不到這位成員", status=404, code="NOT_FOUND")

    def find_sprint(self, sprint_id: int) -> Sprint:
        sprint = self.sprints.get(sprint_id)
        if sprint is None:
            raise ApiError("找不到這個 Sprint", status=404, code="NOT_FOUND")
        return sprint

    def find_task(self, task_id: str) -> Task:
        task = self.tasks.get(task_id)
        if task is None:
            raise ApiError("找不到這個任務", status=404, code="NOT_FOUND")
        return task

    def planning_sprint(self) -> Sprint:
        if self.planning_sprint_id is None:
            raise ApiError("目前沒有規劃中的 Sprint，請先建立 Sprint", status=409, code="NO_PLANNING_SPRINT")
        return self.find_sprint(self.planning_sprint_id)

    def sprint_tasks(self, sprint_id: int) -> list[Task]:
        return [t for t in self.tasks.values() if t.sprint_id == sprint_id]

    def prev_sprint_id(self, sprint_id: int) -> int | None:
        earlier = [i for i in self.sprints if i < sprint_id]
        return max(earlier) if earlier else None

    def members_for(self, sprint: Sprint) -> list[Member]:
        """成員清單，capacity 改為該 Sprint 設定的預估點數；Sprint 有設定容量時，沒列出的成員視為本輪不參與（0 點）"""
        if not sprint.capacity:
            return list(self.members)
        return [m.model_copy(update={"capacity": sprint.capacity.get(m.id, 0)}) for m in self.members]

    def planned_load(self, sprint_id: int, exclude: set[str] | None = None) -> dict[str, int]:
        """每位成員在該 Sprint 已分配的點數（不含延後的任務）"""
        exclude = exclude or set()
        loads: dict[str, int] = {}
        for t in self.sprint_tasks(sprint_id):
            if t.id in exclude or t.state == "DEFERRED" or not t.assignee_id:
                continue
            loads[t.assignee_id] = loads.get(t.assignee_id, 0) + t.story_points
        return loads

    def thread(self, task_id: str) -> PromptThread:
        return self.threads.setdefault(task_id, PromptThread())


_store: MemoryStore | None = None


def get_store() -> MemoryStore:
    global _store
    if _store is None:
        from app.repo.seed import build_seed

        _store = build_seed()
    return _store


Store = Annotated[MemoryStore, Depends(get_store)]
