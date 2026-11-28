"""G5：交付與驗收。對應 frontend/src/types/acceptance.ts"""

from typing import Literal

from app.schemas.base import ApiModel

AcVerdict = Literal["met", "unclear", "mismatch"]
AcceptanceDecision = Literal["approved", "changes"]
TestResult = Literal["passed", "failed", "none"]


class DeliverableItem(ApiModel):
    text: str
    provided: bool


class Delivery(ApiModel):
    """成員送審時提交的交付內容"""

    pr_url: str
    deliverables: list[DeliverableItem]
    test_note: str
    unfinished: str
    questions: str
    submitted_at: str


class SubmitDeliveryInput(ApiModel):
    pr_url: str
    deliverables: list[DeliverableItem]
    test_note: str
    unfinished: str
    questions: str


class AcceptanceItem(ApiModel):
    ac: str
    ai: AcVerdict
    """AI 判斷"""
    evidence: str
    reviewer: AcVerdict | None
    """Reviewer 調整後的判斷；null 表示沿用 AI"""
    note: str


class ReviewItemInput(ApiModel):
    """Reviewer 對每條驗收條件的判斷（沿用 AI 時 reviewer 為 null）

    ai、evidence 是 Reviewer 審查時看到的 AI 判斷與證據，驗收紀錄原樣保存；沒有帶時記為 unclear
    （AI 檢查每次即時產生，不保存，審查通過時也不重新呼叫模型）。
    """

    reviewer: AcVerdict | None
    note: str
    ai: AcVerdict | None = None
    evidence: str = ""


class GoalMatch(ApiModel):
    label: str
    verdict: AcVerdict
    detail: str


class AcceptanceCheck(ApiModel):
    """AI 驗收檢查的整體結果"""

    task_id: str
    items: list[AcceptanceItem]
    deliverables_complete: bool
    missing_deliverables: list[str]
    goal_match: list[GoalMatch]
    tests: TestResult
    test_summary: str
    unfinished: list[str]
    questions: list[str]
    changed_files: list[str]
    summary: str


class AcceptanceRecord(ApiModel):
    id: str
    task_id: str
    items: list[AcceptanceItem]
    decision: AcceptanceDecision
    reason: str
    reviewer_id: str
    at: str
