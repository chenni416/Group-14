"""脈絡組裝（空殼）：決定每個 AI 功能要帶哪些專案資料給模型。

規則：
- 每個功能只帶需要的資料（例如驗收檢查只需要任務規格、驗收條件與交付內容）
- 依「很少變動 → 經常變動」排序，讓 prompt caching 能命中：
  系統提示 → 專案規範與 PRD → Sprint 目標與會議紀錄 → 任務規格 → 本次問題
- 超過 token 上限時，依優先順序略過較不重要的資料並記錄
之後若要加入 RAG 檢索，只需要修改這個模組。
"""

from dataclasses import dataclass, field
from typing import Literal

AiFeature = Literal[
    "analyze_minutes",
    "story_assistant",
    "decompose",
    "suggest_assignee",
    "execution_plan",
    "acceptance_check",
    "living_prompt",
    "context_chat",
]


@dataclass
class ContextBlock:
    title: str
    content: str
    cacheable: bool = True
    """固定內容（規範、PRD）設為 True，放在前面並加上快取標記"""


@dataclass
class AiContext:
    feature: AiFeature
    system: str
    blocks: list[ContextBlock] = field(default_factory=list)


def build_context(
    feature: AiFeature,
    *,
    project_id: str,
    sprint_id: int | None = None,
    task_id: str | None = None,
) -> AiContext:
    raise NotImplementedError(f"{feature} 的脈絡組裝尚未實作")
