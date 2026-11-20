"""Sprint、延續事項與相依分析。對應 frontend/src/types/sprint.ts"""

from typing import Literal

from app.schemas.base import ApiModel
from app.schemas.project import UploadDocInput

SprintStatus = Literal["planning", "active", "closed"]
PlanningStep = Literal[1, 2, 3, 4, 5]
"""規劃五階段：1 上輪統整 → 2 設定 → 3 Story → 4 Task 與派工 → 5 派工總覽與發送"""
BacklogDecision = Literal["include", "keep", "remove"]
DependencyRisk = Literal["high", "mid", "ok"]


class SprintDoc(ApiModel):
    name: str
    size: str


class ClarifyQuestion(ApiModel):
    """AI 從會議紀錄找出沒講清楚的地方"""

    id: str
    question: str
    options: list[str]
    answer: str


class SprintSummary(ApiModel):
    total: int
    done: int
    tasks: int


class Sprint(ApiModel):
    id: int
    name: str
    start: str
    """顯示用 MM/DD"""
    end: str
    start_date: str
    """YYYY-MM-DD"""
    end_date: str
    goal: str
    status: SprintStatus
    capacity: dict[str, int]
    """成員 id → 本次預估點數"""
    minutes: str
    docs: list[SprintDoc]
    questions: list[ClarifyQuestion] | None
    """null 表示尚未分析會議紀錄"""
    step: PlanningStep
    summary: SprintSummary | None


class BacklogItem(ApiModel):
    """延續事項：延後或跨 Sprint 的問題"""

    id: str
    text: str
    from_sprint: str
    kind: Literal["deferred", "multi"]
    task_id: str | None
    used_in_sprint_id: int | None
    decision: BacklogDecision | None


class NewSprintDefaults(ApiModel):
    id: int
    name: str
    start_date: str
    end_date: str
    capacity: dict[str, int]
    minutes: str
    carry_count: int


class CreateSprintInput(ApiModel):
    name: str
    start_date: str
    end_date: str
    goal: str
    capacity: dict[str, int]
    minutes: str
    docs: list[SprintDoc]


class UpdateSprintInput(ApiModel):
    """只傳要修改的欄位"""

    name: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    goal: str | None = None
    capacity: dict[str, int] | None = None
    minutes: str | None = None
    docs: list[SprintDoc] | None = None


class AddSprintDocsBody(ApiModel):
    files: list[UploadDocInput]


class AnalyzeBody(ApiModel):
    minutes: str


class AnswerBody(ApiModel):
    answer: str


class BacklogDecisionBody(ApiModel):
    decision: BacklogDecision | None


class Dependency(ApiModel):
    """AI 相依性分析：本次任務依賴上一個 Sprint（prev）或本 Sprint（same）的哪個任務"""

    scope: Literal["prev", "same"]
    task_id: str
    depends_on_id: str
    reason: str
    risk: DependencyRisk


class BurndownPoint(ApiModel):
    label: str
    ideal: float
    actual: float | None


class AnalyzeResult(ApiModel):
    unanswered: int


class EndSprintResult(ApiModel):
    unfinished: int


class StartSprintResult(ApiModel):
    carried_over: int
    deferred: int


class CreatedResult(ApiModel):
    created: int


class DeferredResult(ApiModel):
    deferred: int


class UpdatedResult(ApiModel):
    updated: int
