"""Sprint 規劃的商業邏輯：AI 分析會議紀錄 → Story 草稿（草稿不寫入資料庫，由使用者確認後才送出）"""

import re

from app.ai import audit
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmStory, LlmStoryDraft
from app.core.errors import ApiError
from app.schemas.planning import (
    DraftDependency,
    GenerateDraftInput,
    MinutesQuote,
    PlanningDraft,
    StoryClarifyItem,
    StoryDraft,
)

MAX_MINUTES_CHARS = 30_000

_CARRY_LABEL = re.compile(r"\s*[（(]\s*(延後項目|跨 Sprint 項目|延續項目|延後|跨 Sprint)\s*[）)]\s*$")
"""模型偶爾會把「延後項目」「跨 Sprint 項目」寫進 Story 標題。標題帶「延後」字樣時，拆 Task 的模型會誤以為
這個 Story 已延後而整個跳過，所以標記只能放在 rationale，不能放在標題"""


def _clean_title(title: str, rationale: str) -> tuple[str, str]:
    match = _CARRY_LABEL.search(title)
    if not match:
        return title, rationale
    label = match.group(1)
    if not label.endswith("項目"):
        label += "項目"
    audit.note("strip_title_label", f"Story 標題「{title}」的「{label}」標記移到說明欄，避免拆 Task 時被當成已延後")
    clean = title[: match.start()].strip()
    return clean, rationale if label in rationale else f"{rationale}（{label}）"


def story_code(sprint_id: int, no: int) -> str:
    """與前端 lib/planning.ts 的 storyCode 一致"""
    return f"S{sprint_id}-{no}"


def _numbered(minutes: str) -> list[str]:
    return minutes.splitlines()


def build_user_message(goal: str, lines: list[str]) -> str:
    numbered = "\n".join(f"{i}  {text}" for i, text in enumerate(lines, start=1))
    return (
        "<sprint_goal>\n"
        f"{goal.strip() or '（Leader 尚未填寫，請依會議紀錄推斷）'}\n"
        "</sprint_goal>\n\n"
        "<meeting_minutes>\n"
        f"{numbered}\n"
        "</meeting_minutes>"
    )


def _to_story(raw: LlmStory, no: int, sprint_id: int, lines: list[str], total: int) -> StoryDraft:
    unique_lines = list(dict.fromkeys(raw.source_lines))  # 去重並保留順序
    if len(unique_lines) != len(raw.source_lines):
        audit.note("dedupe_source_lines", f"Story {no}：來源行號有重複，已去重", story_no=no, raw=raw.source_lines)
    sources = [
        MinutesQuote(line=n, text=lines[n - 1].strip())
        for n in unique_lines
        if 1 <= n <= len(lines) and lines[n - 1].strip()  # 丟掉模型編造的行號
    ]
    bad_lines = [n for n in unique_lines if not (1 <= n <= len(lines) and lines[n - 1].strip())]
    if bad_lines:
        audit.note(
            "drop_source_lines",
            f"Story {no}「{raw.title}」：捨棄超出範圍或空白的來源行號 {bad_lines}（會議紀錄共 {len(lines)} 行）",
            story_no=no,
            dropped=bad_lines,
        )
    depends = [
        DraftDependency(id=f"st-{d.story_no}", reason=d.reason)
        for d in raw.depends_on
        if 1 <= d.story_no <= total and d.story_no != no
    ]
    bad_deps = [d.story_no for d in raw.depends_on if not (1 <= d.story_no <= total and d.story_no != no)]
    if bad_deps:
        audit.note(
            "drop_story_dependencies",
            f"Story {no}：捨棄指向不存在或自己的相依 {bad_deps}（共 {total} 個 Story）",
            story_no=no,
            dropped=bad_deps,
        )
    clarify = [
        StoryClarifyItem(
            id=f"cq-{no}-{i}",
            kind=c.kind,
            text=c.text,
            options=c.options if c.kind == "question" and c.options else None,
            effect=c.effect,
        )
        for i, c in enumerate(raw.clarify, start=1)
    ]
    title, rationale = _clean_title(raw.title.strip(), raw.rationale)
    return StoryDraft(
        id=f"st-{no}",
        no=no,
        code=story_code(sprint_id, no),
        title=title,
        user_story=raw.user_story,
        story_points=raw.story_points,
        scope=raw.scope,
        rationale=rationale,
        sources=sources,
        depends_on=depends,
        clarify=clarify or None,
    )


def generate_draft(body: GenerateDraftInput, llm: LlmClient, sprint_id: int) -> PlanningDraft:
    minutes = body.minutes.strip()
    if not minutes:
        raise ApiError("請先貼上會議紀錄")
    if len(minutes) > MAX_MINUTES_CHARS:
        raise ApiError(f"會議紀錄過長（上限 {MAX_MINUTES_CHARS} 字），請分段或精簡後再分析", status=413)

    lines = _numbered(minutes)
    result = llm.generate_json(
        system=load_prompt("analyze_minutes"),
        user=build_user_message(body.goal, lines),
        schema=LlmStoryDraft,
    )
    if not result.stories:
        audit.note("empty_result", "模型沒有切出任何 Story，回傳 422")
        raise ApiError("AI 沒有從會議紀錄切分出任何 Story，請補充內容後再試", status=422, code="AI_EMPTY_RESULT")

    total = len(result.stories)
    stories = [_to_story(s, i, sprint_id, lines, total) for i, s in enumerate(result.stories, start=1)]
    return PlanningDraft(sprint_id=sprint_id, stories=stories, tasks=[])
