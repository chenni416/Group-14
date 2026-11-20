"""任務。對應 frontend/src/types/task.ts"""

from typing import Literal

from app.schemas.acceptance import Delivery, ReviewItemInput
from app.schemas.base import ApiModel
from app.schemas.member import Domain
from app.schemas.project import ReviewPolicy

TaskState = Literal[
    "DRAFT",
    "AI_DRAFT",
    "PENDING_MEMBER",
    "RETURNED",
    "ASSIGNED",
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "DEFERRED",
]
"""DEFERRED：延後到之後的 Sprint"""

CarryStatus = Literal["pending", "accepted", "returned"]
NegotiateTarget = Literal["scope", "ac", "points", "assignee", "other"]


class PullRequest(ApiModel):
    number: int
    status: Literal["open", "merged"]
    url: str | None = None
    tests: Literal["passed", "failed", "none"] | None = None
    changed_files: list[str] | None = None
    summary: str | None = None


class Negotiation(ApiModel):
    by_id: str
    reason: str
    suggest_id: str | None
    target: NegotiateTarget | None = None


class PlanConfirm(ApiModel):
    """成員對「延後或調整」的回覆"""

    member_id: str
    status: Literal["agree", "object"]
    note: str
    at: str


class ReturnSnapshot(ApiModel):
    """協商退回當下的內容，用來列出 Leader 修改了哪些地方"""

    title: str
    acceptance_criteria: list[str]
    story_points: int
    story_points_reason: str
    assignee_id: str
    policy: ReviewPolicy


class TaskDependency(ApiModel):
    id: str
    reason: str


class Task(ApiModel):
    id: str
    sprint_id: int
    title: str
    description: str
    domain: Domain
    tags: list[str]
    story_points: int
    story_points_reason: str
    acceptance_criteria: list[str]
    epic: str
    story: str
    origin: Literal["ai", "human"]
    edited: bool
    """Leader 是否調整過 AI 建議"""
    state: TaskState
    assignee_id: str
    suggested_assignee_id: str | None
    suggest_reason: str
    policy: ReviewPolicy
    policy_reason: str
    reviewer_id: str | None
    approvals: list[str]
    claimed_at: str | None
    review_started_at: str | None
    pr: PullRequest | None
    branch: str
    negotiation: Negotiation | None
    source: str
    """來源句：任務來自會議紀錄的哪一句"""
    carry_tag: Literal["deferred", "multi"] | None
    multi_sprint: bool
    clarified: bool
    carry: bool | None
    """上輪未完成任務：true 帶入、false 延後、null 尚未決定"""
    carry_assignee_id: str | None
    carry_points: int | None
    carry_status: CarryStatus | None
    depends_on: list[TaskDependency]
    """前置任務（需先完成）"""
    return_snapshot: ReturnSnapshot | None
    prev_state: TaskState | None
    scope: str
    out_of_scope: str
    responsibility: str
    deliverables: list[str]
    plan_confirms: list[PlanConfirm]
    delivery: Delivery | None


class UpdateTaskInput(ApiModel):
    """只傳要修改的欄位；assigneeId 為空字串表示未指派"""

    title: str | None = None
    story_points: int | None = None
    story_points_reason: str | None = None
    assignee_id: str | None = None
    acceptance_criteria: list[str] | None = None
    policy: ReviewPolicy | None = None
    multi_sprint: bool | None = None
    scope: str | None = None
    out_of_scope: str | None = None
    responsibility: str | None = None
    deliverables: list[str] | None = None


class CreateTaskInput(ApiModel):
    title: str
    domain: Domain
    story_points: int
    story_points_reason: str
    assignee_id: str
    """空字串表示未指派，核准前檢查會擋下"""
    acceptance_criteria: list[str]
    policy: ReviewPolicy
    source: str


class NegotiateInput(ApiModel):
    reason: str
    suggest_id: str | None
    target: NegotiateTarget | None = None


class ReviseTaskInput(ApiModel):
    """協商退回後，Leader 編輯並重新派工"""

    title: str
    story_points: int
    acceptance_criteria: list[str]
    assignee_id: str
    policy: ReviewPolicy


class SetCarryInput(ApiModel):
    """上輪未完成任務：帶入或延後（省略的欄位表示不變）"""

    carry: bool | None
    assignee_id: str | None = None
    points: int | None = None


class ApproveReviewBody(ApiModel):
    items: list[ReviewItemInput] | None = None


class RequestChangesBody(ApiModel):
    note: str
    items: list[ReviewItemInput] | None = None


class PlanConfirmBody(ApiModel):
    status: Literal["agree", "object"]
    note: str


class ReviewResult(ApiModel):
    completed: bool
    approvals: int
    required: int


class ResendResult(ApiModel):
    task: Task
    changes: list[str]


class SuggestAssigneeResult(ApiModel):
    task: Task
    fits: bool


class CountResult(ApiModel):
    count: int
