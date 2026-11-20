"""模型輸出格式（只給 LLM 看的精簡版）。

和 app/schemas 的 API 格式分開：模型只負責內容，id、編號、行號對應的原文由程式補上，
避免模型編造 id 或引用不存在的會議紀錄。
"""

from typing import Literal

from pydantic import BaseModel


class LlmClarify(BaseModel):
    kind: Literal["question", "suggestion"]
    text: str
    options: list[str]
    effect: str


class LlmDependency(BaseModel):
    story_no: int
    reason: str


class LlmStory(BaseModel):
    title: str
    user_story: str
    story_points: int
    scope: list[str]
    rationale: str
    source_lines: list[int]
    depends_on: list[LlmDependency]
    clarify: list[LlmClarify]


class LlmStoryDraft(BaseModel):
    stories: list[LlmStory]


# ---------- Task 拆解與指派 ----------


class LlmTaskDep(BaseModel):
    story_no: int
    task_no: int
    reason: str


class LlmTask(BaseModel):
    story_no: int
    title: str
    domain: Literal["FE", "BE", "AI", "QA", "DS"]
    branch_prefix: Literal["feat", "fix", "test", "refactor", "chore"]
    branch_slug: str
    story_points: int
    acceptance_criteria: list[str]
    analysis: str
    reviewer_mode: Literal["pool", "leader"]
    depends_on: list[LlmTaskDep]
    """task_no 為該 Story 內 Task 的順序（1 起算）"""


class LlmTaskDraft(BaseModel):
    tasks: list[LlmTask]


class LlmAssignment(BaseModel):
    task_code: str
    member_id: str
    reason: str


class LlmAssignments(BaseModel):
    assignments: list[LlmAssignment]


class LlmReassign(BaseModel):
    member_id: str
    reason: str
    fits: bool


class LlmDeferral(BaseModel):
    task_ids: list[str]
    reason: str


# ---------- Sprint 分析 ----------


class LlmQuestion(BaseModel):
    question: str
    options: list[str]


class LlmQuestions(BaseModel):
    questions: list[LlmQuestion]


class LlmTaskDependency(BaseModel):
    scope: Literal["prev", "same"]
    task_id: str
    depends_on_id: str
    reason: str
    risk: Literal["high", "mid", "ok"]


class LlmTaskDependencies(BaseModel):
    dependencies: list[LlmTaskDependency]


# ---------- 執行計畫 ----------


class LlmChecklistItem(BaseModel):
    text: str
    ac_index: int | None
    day_offset: int


class LlmCheckpoint(BaseModel):
    title: str
    day_offset: int


class LlmDepCheck(BaseModel):
    text: str
    source: str


class LlmExecutionPlan(BaseModel):
    checklist: list[LlmChecklistItem]
    checkpoints: list[LlmCheckpoint]
    dep_checks: list[LlmDepCheck]


# ---------- 驗收檢查與脈絡對話 ----------


class LlmAcItem(BaseModel):
    ac_index: int
    verdict: Literal["met", "unclear", "mismatch"]
    evidence: str


class LlmGoalMatch(BaseModel):
    label: str
    verdict: Literal["met", "unclear", "mismatch"]
    detail: str


class LlmAcceptance(BaseModel):
    items: list[LlmAcItem]
    goal_match: list[LlmGoalMatch]
    summary: str


class LlmChat(BaseModel):
    answer: str
    sources: list[str]
    prompt_addition: str | None
