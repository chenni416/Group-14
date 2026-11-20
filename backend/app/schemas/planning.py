"""Sprint 規劃草稿（Story 切分、Task 拆解）。對應 frontend/src/types/planning.ts"""

from typing import Literal

from app.schemas.base import ApiModel
from app.schemas.member import Domain

BranchPrefix = Literal["feat", "fix", "test", "refactor", "chore"]
ReviewerMode = Literal["pool", "leader", "member"]


class ReviewerAssignment(ApiModel):
    mode: ReviewerMode
    member_id: str | None


class MinutesQuote(ApiModel):
    line: int
    """會議紀錄行號（1 起算）"""
    text: str


class DraftDependency(ApiModel):
    """依賴對象：StoryDraft.id、TaskDraft.id，或上輪帶入任務的 Task.id"""

    id: str
    reason: str


class StoryClarifyItem(ApiModel):
    """AI 對 Story 的待釐清項目：question 提問、suggestion 建議"""

    id: str
    kind: Literal["question", "suggestion"]
    text: str
    options: list[str] | None = None
    effect: str
    answer: str | None = None
    decision: Literal["accept", "reject"] | None = None


class StoryDraft(ApiModel):
    id: str
    no: int
    code: str
    """例如 S3-1"""
    title: str
    user_story: str
    story_points: int
    scope: list[str]
    rationale: str
    sources: list[MinutesQuote]
    depends_on: list[DraftDependency]
    deferred: bool | None = None
    clarify: list[StoryClarifyItem] | None = None


class TaskDraft(ApiModel):
    id: str
    story_id: str
    no: int
    code: str
    """任務編號 S-{Sprint}{Story 序號}{Task 序號}，例如 S-321"""
    title: str
    domain: Domain
    branch_prefix: BranchPrefix
    branch_slug: str
    story_points: int
    acceptance_criteria: list[str]
    assignee_id: str | None
    suggested_assignee_id: str | None
    reviewer: ReviewerAssignment
    analysis: str
    assign_reason: str
    depends_on: list[DraftDependency]
    deferred: bool | None = None


class PlanningDraft(ApiModel):
    sprint_id: int
    stories: list[StoryDraft]
    tasks: list[TaskDraft]


class GenerateDraftInput(ApiModel):
    goal: str
    minutes: str


class GenerateTasksInput(ApiModel):
    sprint_id: int
    stories: list[StoryDraft]
    existing_task_count: int


class StoryAssistantBody(ApiModel):
    question: str
    story_title: str | None
