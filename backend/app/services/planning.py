"""Sprint 規劃的商業邏輯：AI 分析會議紀錄 → Story 草稿（草稿不寫入資料庫，由使用者確認後才送出）"""

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
    sources = [
        MinutesQuote(line=n, text=lines[n - 1].strip())
        for n in dict.fromkeys(raw.source_lines)  # 去重並保留順序
        if 1 <= n <= len(lines) and lines[n - 1].strip()  # 丟掉模型編造的行號
    ]
    depends = [
        DraftDependency(id=f"st-{d.story_no}", reason=d.reason)
        for d in raw.depends_on
        if 1 <= d.story_no <= total and d.story_no != no
    ]
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
    return StoryDraft(
        id=f"st-{no}",
        no=no,
        code=story_code(sprint_id, no),
        title=raw.title,
        user_story=raw.user_story,
        story_points=raw.story_points,
        scope=raw.scope,
        rationale=raw.rationale,
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
        raise ApiError("AI 沒有從會議紀錄切分出任何 Story，請補充內容後再試", status=422, code="AI_EMPTY_RESULT")

    total = len(result.stories)
    stories = [_to_story(s, i, sprint_id, lines, total) for i, s in enumerate(result.stories, start=1)]
    return PlanningDraft(sprint_id=sprint_id, stories=stories, tasks=[])
