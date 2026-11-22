"""每個 Story 都要有 Task：模型漏掉的 Story 要補拆，標題的延後標記要移到說明欄。

這是在網頁實測發現的問題：帶入的延續事項切成 Story 後，標題寫著「（延後項目）」，
拆 Task 的模型把它當成已延後而整個跳過，這些需求就悄悄消失了。"""

from app.ai import audit, schemas
from app.schemas.planning import GenerateTasksInput, StoryDraft
from app.services import planning, task_planning
from tests.test_ai_services import llm_task

MINUTES = "討論對話功能\n需要保留對話紀錄\n\nEmail 推播提醒"


def _story(no: int, title: str, deferred=None) -> StoryDraft:
    return StoryDraft(
        id=f"st-{no}",
        no=no,
        code=f"S3-{no}",
        title=title,
        user_story="身為成員，我想要…",
        story_points=3,
        scope=["範疇"],
        rationale="說明",
        sources=[],
        depends_on=[],
        deferred=deferred,
    )


class SkippingLlm:
    """第一次只回傳 Story 1 的 Task（漏掉其他 Story）；之後依收到的 Story 回傳"""

    def __init__(self, skip_first_time: set[int]) -> None:
        self.skip = skip_first_time
        self.users: list[str] = []

    def generate_json(self, *, system: str, user: str, schema):
        self.users.append(user)
        wanted = [n for n in (1, 2, 3) if f"Story no={n}｜" in user]
        if len(self.users) == 1:
            wanted = [n for n in wanted if n not in self.skip]
        return schemas.LlmTaskDraft(tasks=[llm_task(story_no=n, title=f"Task of {n}") for n in wanted])

    def generate_text(self, *, system: str, user: str) -> str:
        return ""


def _body(*stories: StoryDraft) -> GenerateTasksInput:
    return GenerateTasksInput(sprint_id=3, stories=list(stories), existing_task_count=0)


def test_uncovered_story_is_retried_and_gets_tasks() -> None:
    llm = SkippingLlm(skip_first_time={2, 3})
    drafts = task_planning.generate_tasks(_body(_story(1, "A"), _story(2, "B"), _story(3, "C")), [], llm)

    assert [d.story_id for d in drafts] == ["st-1", "st-2", "st-3"]  # 依 Story 順序排列
    assert [d.code for d in drafts] == ["S-311", "S-321", "S-331"]
    assert len(llm.users) == 2
    retry = llm.users[1]  # 第二次只問漏掉的 Story，不重複已拆好的
    assert "Story no=2｜" in retry and "Story no=3｜" in retry and "Story no=1｜" not in retry


def test_no_retry_when_every_story_is_covered() -> None:
    llm = SkippingLlm(skip_first_time=set())
    task_planning.generate_tasks(_body(_story(1, "A"), _story(2, "B")), [], llm)
    assert len(llm.users) == 1


def test_story_still_uncovered_after_retry_is_reported_not_raised() -> None:
    class NeverStory2(SkippingLlm):
        def generate_json(self, *, system: str, user: str, schema):
            result = super().generate_json(system=system, user=user, schema=schema)
            return schemas.LlmTaskDraft(tasks=[t for t in result.tasks if t.story_no != 2])

    record = audit.Record(request={})
    token = audit._current.set(record)
    try:
        drafts = task_planning.generate_tasks(_body(_story(1, "A"), _story(2, "B")), [], NeverStory2(set()))
    finally:
        audit._current.reset(token)

    assert {d.story_id for d in drafts} == {"st-1"}
    kinds = [a["kind"] for a in record.adjustments]
    assert kinds.count("retry_uncovered_stories") == 1 and "uncovered_stories" in kinds  # 記錄下來，讓 Leader 知道


def test_deferred_stories_are_not_decomposed_or_retried() -> None:
    llm = SkippingLlm(skip_first_time=set())
    drafts = task_planning.generate_tasks(_body(_story(1, "A"), _story(2, "B", deferred=True)), [], llm)
    assert {d.story_id for d in drafts} == {"st-1"} and len(llm.users) == 1


# ---------- 標題的延後標記 ----------


def _llm_story(title: str, rationale="同一情境") -> schemas.LlmStory:
    return schemas.LlmStory(
        title=title,
        user_story="身為 Leader，我想要…",
        story_points=3,
        scope=["指派事件 Email 通知"],
        rationale=rationale,
        source_lines=[3],
        depends_on=[],
        clarify=[],
    )


def test_deferral_label_moves_from_title_to_rationale() -> None:
    cases = [
        ("Email 推播提醒（延後項目）", "Email 推播提醒", "延後項目"),
        ("AI 拆解準確率評估 (跨 Sprint 項目)", "AI 拆解準確率評估", "跨 Sprint 項目"),
        ("通知中心（延後）", "通知中心", "延後項目"),
    ]
    for raw_title, title, label in cases:
        story = planning._to_story(_llm_story(raw_title), 1, 3, MINUTES.splitlines(), 1)
        assert story.title == title
        assert story.rationale == f"同一情境（{label}）"


def test_label_not_duplicated_when_rationale_already_mentions_it() -> None:
    story = planning._to_story(
        _llm_story("Email 推播提醒（延後項目）", rationale="延後項目，Sprint 2 延後"), 1, 3, MINUTES.splitlines(), 1
    )
    assert story.rationale == "延後項目，Sprint 2 延後"


def test_normal_titles_are_untouched() -> None:
    for title in ("任務內 AI 對話", "延後通知的處理機制", "跨 Sprint 的相依管理"):
        assert planning._to_story(_llm_story(title), 1, 3, MINUTES.splitlines(), 1).title == title
