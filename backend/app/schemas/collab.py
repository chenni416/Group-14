"""執行計畫、問題、提案、留言、回顧、通知、Prompt 與對話。

對應 frontend/src/types 的 execution.ts、issue.ts、comment.ts、retro.ts、notification.ts、chat.ts
"""

from typing import Literal

from app.schemas.base import ApiModel

# ---------- G3：執行計畫 ----------


class ChecklistItem(ApiModel):
    id: str
    text: str
    done: bool
    ac_index: int | None
    """對應第幾條驗收條件（0 起算）"""
    due_at: str | None


class Checkpoint(ApiModel):
    id: str
    title: str
    due_at: str
    reached_at: str | None


class DepCheck(ApiModel):
    id: str
    text: str
    met: bool
    source: str


class ExecutionPlan(ApiModel):
    task_id: str
    checklist: list[ChecklistItem]
    checkpoints: list[Checkpoint]
    dep_checks: list[DepCheck]
    origin: Literal["ai", "human"]
    edited: bool
    confirmed_at: str | None


class SaveExecutionPlanInput(ApiModel):
    checklist: list[ChecklistItem]
    checkpoints: list[Checkpoint]
    dep_checks: list[DepCheck]


# ---------- G4：問題回報 ----------

IssueType = Literal["tech", "dependency", "schedule", "other"]
IssueStatus = Literal["reported", "assigned", "responded", "resolved", "replan"]


class IssueResponse(ApiModel):
    id: str
    by_id: str
    text: str
    at: str


class Issue(ApiModel):
    id: str
    task_id: str
    type: IssueType
    description: str
    reporter_id: str
    owner_id: str | None
    suggested_owner_id: str | None
    owner_reason: str
    status: IssueStatus
    responses: list[IssueResponse]
    created_at: str
    updated_at: str
    sprint_id: int


class ReportIssueInput(ApiModel):
    task_id: str
    type: IssueType
    description: str
    prefer_owner_id: str | None


class AssignIssueBody(ApiModel):
    owner_id: str


class TextBody(ApiModel):
    text: str


# ---------- G4：提案 ----------

ProposalKind = Literal["idea", "improve", "change"]
ProposalStatus = Literal["open", "adopted", "rejected", "nextSprint"]


class ProposalComment(ApiModel):
    id: str
    by_id: str
    text: str
    at: str


class Proposal(ApiModel):
    id: str
    title: str
    description: str
    kind: ProposalKind
    author_id: str
    task_id: str | None
    status: ProposalStatus
    decision: str
    decided_by_id: str | None
    comments: list[ProposalComment]
    created_at: str
    sprint_id: int


class CreateProposalInput(ApiModel):
    title: str
    description: str
    kind: ProposalKind
    task_id: str | None


class DecideProposalInput(ApiModel):
    decision: Literal["adopted", "rejected", "nextSprint"]
    reason: str


# ---------- 任務留言區 ----------


class TaskComment(ApiModel):
    id: str
    task_id: str
    by_id: str
    text: str
    mentions: list[str]
    """被 @ 標注的成員 id"""
    at: str


class AddCommentInput(ApiModel):
    text: str
    mentions: list[str]


# ---------- G7：回顧 ----------

RetroStatus = Literal["open", "closed"]


class RetroEntry(ApiModel):
    id: str
    by_id: str
    well: str
    hard: str
    improve: str


class RetroAction(ApiModel):
    id: str
    text: str
    owner_id: str
    done: bool
    from_sprint_id: int
    used_in_sprint_id: int | None


class Retro(ApiModel):
    sprint_id: int
    status: RetroStatus
    entries: list[RetroEntry]
    actions: list[RetroAction]


class SubmitRetroEntryInput(ApiModel):
    well: str
    hard: str
    improve: str


class AddRetroActionInput(ApiModel):
    text: str
    owner_id: str


# ---------- 通知 ----------

NotificationType = Literal["invite", "review", "pool", "returned", "info", "issue", "proposal", "plan", "mention"]


class Notification(ApiModel):
    id: str
    to_id: str
    from_id: str
    type: NotificationType
    task_id: str
    """提案可以沒有關聯任務，此時為空字串"""
    ref_id: str | None = None
    text: str
    created_at: str
    status: Literal["pending", "done"]


# ---------- Living Prompt 與專案脈絡助理 ----------


class ChatMessage(ApiModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    sources: list[str] | None = None
    prompt_addition: str | None = None
    prompt_version: int | None = None


class PromptState(ApiModel):
    versions: list[list[str]]
    """每個版本完整的 Prompt 行"""
    current: int


class PromptVersionBody(ApiModel):
    version: int


class AskBody(ApiModel):
    question: str
