"""AI 服務層：用假的 LLM 驗證輸出的校正與防呆（不呼叫 OpenAI）"""

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.ai import schemas as s
from app.ai.context import DocSnippet
from app.ai.llm import get_llm
from app.core.errors import ApiError
from app.main import app
from app.ports import get_members
from app.schemas.acceptance import DeliverableItem, Delivery
from app.schemas.collab import ChatMessage
from app.schemas.member import Member
from app.schemas.planning import (
    DraftDependency,
    GenerateTasksInput,
    ReviewerAssignment,
    StoryAssistantBody,
    StoryDraft,
    TaskDraft,
)
from app.schemas.task import PullRequest, Task, TaskDependency
from app.services import acceptance_ai, chat_ai, execution_ai, sprint_ai, task_planning


class FakeLlm:
    """依 schema 型別回傳預先指定的結果，並記錄收到的訊息"""

    def __init__(self, *results, text: str = "ok") -> None:
        self.results = {type(r): r for r in results}
        self.text = text
        self.calls: list[tuple[type, str, str]] = []

    def generate_json(self, *, system: str, user: str, schema):
        self.calls.append((schema, system, user))
        return self.results[schema]

    def generate_text(self, *, system: str, user: str) -> str:
        self.calls.append((str, system, user))
        return self.text


# ---------- 測試資料 ----------


def member(id: str, domain="BE", capacity=10, tags=("python",)) -> Member:
    return Member(
        id=id,
        name=id.upper(),
        email=f"{id}@x.com",
        role="Member",
        title="",
        domain=domain,
        tags=list(tags),
        capacity=capacity,
    )


def story(no: int, deferred=None) -> StoryDraft:
    return StoryDraft(
        id=f"st-{no}",
        no=no,
        code=f"S3-{no}",
        title=f"Story {no}",
        user_story="身為成員…",
        story_points=5,
        scope=["a", "b"],
        rationale="",
        sources=[],
        depends_on=[],
        deferred=deferred,
    )


def llm_task(story_no=1, title="T", deps=(), **over) -> s.LlmTask:
    base = dict(
        story_no=story_no,
        title=title,
        domain="BE",
        branch_prefix="feat",
        branch_slug="Chat API!",
        story_points=3,
        acceptance_criteria=["a1", " "],
        analysis="做法",
        reviewer_mode="pool",
        depends_on=list(deps),
    )
    return s.LlmTask(**{**base, **over})


def draft(no: int, sp=3, assignee=None, suggested=None, deps=(), deferred=None) -> TaskDraft:
    return TaskDraft(
        id=f"st-1-tk-{no}",
        story_id="st-1",
        no=no,
        code=f"S-31{no}",
        title=f"task {no}",
        domain="BE",
        branch_prefix="feat",
        branch_slug="x",
        story_points=sp,
        acceptance_criteria=["ac"],
        assignee_id=assignee,
        suggested_assignee_id=suggested,
        reviewer=ReviewerAssignment(mode="pool", member_id=None),
        analysis="",
        assign_reason="",
        depends_on=[DraftDependency(id=i, reason="r") for i in deps],
        deferred=deferred,
    )


def task(id="S-321", acs=("AC0", "AC1 要有測試"), delivery=None, pr=None, state="IN_REVIEW", deps=()) -> Task:
    return Task.model_construct(
        id=id,
        title="任務",
        description="目標",
        domain="BE",
        story_points=3,
        state=state,
        scope="範圍",
        out_of_scope="",
        deliverables=["API"],
        depends_on=[TaskDependency(id=d, reason="r") for d in deps],
        acceptance_criteria=list(acs),
        delivery=delivery,
        pr=pr,
    )


# ---------- generate_tasks ----------


def test_generate_tasks_builds_codes_sanitizes_and_drops_bad_data() -> None:
    result = s.LlmTaskDraft(
        tasks=[
            llm_task(1, "A", story_points=99),
            llm_task(1, "B", deps=[s.LlmTaskDep(story_no=1, task_no=1, reason="先做 A")]),
            llm_task(
                1,
                "C",
                deps=[
                    s.LlmTaskDep(story_no=1, task_no=3, reason="自己"),
                    s.LlmTaskDep(story_no=9, task_no=1, reason="不存在"),
                ],
            ),
            llm_task(7, "不存在的 Story"),
            llm_task(2, "延後的 Story 不會有 Task"),
        ]
    )
    stories = [story(1), story(2, deferred=True)]
    drafts = task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=3, stories=stories, existing_task_count=0), [], FakeLlm(result)
    )

    assert [d.code for d in drafts] == ["S-311", "S-312", "S-313"]
    assert [d.id for d in drafts] == ["st-1-tk-1", "st-1-tk-2", "st-1-tk-3"]
    assert drafts[0].story_points == 13  # 夾在合理範圍
    assert drafts[0].branch_slug == "chat-api"
    assert drafts[0].acceptance_criteria == ["a1"]  # 空白條件被丟掉
    assert [d.id for d in drafts[1].depends_on] == ["st-1-tk-1"]
    assert drafts[2].depends_on == []  # 依賴自己、依賴不存在的都被丟掉
    assert all(d.suggested_assignee_id is None and d.assignee_id is None for d in drafts)


def test_generate_tasks_drops_dependency_cycles() -> None:
    a = llm_task(1, "A", deps=[s.LlmTaskDep(story_no=1, task_no=2, reason="x")])
    b = llm_task(1, "B", deps=[s.LlmTaskDep(story_no=1, task_no=1, reason="y")])
    drafts = task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=1, stories=[story(1)], existing_task_count=0),
        [],
        FakeLlm(s.LlmTaskDraft(tasks=[a, b])),
    )
    assert [len(d.depends_on) for d in drafts] == [1, 0]  # 互相依賴只留第一條


def test_generate_tasks_suggests_assignees_and_ignores_invalid_member() -> None:
    fake = FakeLlm(
        s.LlmTaskDraft(tasks=[llm_task(1, "A"), llm_task(1, "B")]),
        s.LlmAssignments(
            assignments=[
                s.LlmAssignment(task_code="S-111", member_id="m1", reason="熟悉後端"),
                s.LlmAssignment(task_code="S-112", member_id="ghost", reason="編造的成員"),
            ]
        ),
    )
    drafts = task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=1, stories=[story(1)], existing_task_count=0), [member("m1")], fake
    )
    assert drafts[0].suggested_assignee_id == "m1" and drafts[0].assign_reason == "熟悉後端"
    assert drafts[1].suggested_assignee_id is None
    assert drafts[0].assignee_id is None  # 建議不等於指派，由 Leader 決定


def test_generate_tasks_requires_active_story_and_non_empty_result() -> None:
    with pytest.raises(ApiError):
        task_planning.generate_tasks(
            GenerateTasksInput(sprint_id=1, stories=[story(1, deferred=True)], existing_task_count=0), [], FakeLlm()
        )
    with pytest.raises(ApiError) as e:
        task_planning.generate_tasks(
            GenerateTasksInput(sprint_id=1, stories=[story(1)], existing_task_count=0),
            [],
            FakeLlm(s.LlmTaskDraft(tasks=[])),
        )
    assert e.value.code == "AI_EMPTY_RESULT"


# ---------- Story 助理、延後、重新平衡 ----------


def test_story_assistant_returns_text_and_wraps_question() -> None:
    fake = FakeLlm(text="  建議拆成兩個 Story  ")
    reply = task_planning.story_assistant_reply(
        StoryAssistantBody(question="太大了？", story_title="S1"), "目標", [story(1)], fake
    )
    assert reply == "建議拆成兩個 Story"
    assert "<question>\n太大了？\n</question>" in fake.calls[0][2]
    with pytest.raises(ApiError):
        task_planning.story_assistant_reply(StoryAssistantBody(question=" ", story_title=None), "", [], fake)


def test_defer_suggested_skips_llm_when_within_capacity() -> None:
    fake = FakeLlm()
    assert task_planning.defer_suggested([draft(1, sp=5)], "g", [member("m1", capacity=10)], fake) == []
    assert fake.calls == []


def test_defer_suggested_includes_dependents_and_ignores_unknown_ids() -> None:
    drafts = [draft(1, sp=5), draft(2, sp=5, deps=["st-1-tk-1"]), draft(3, sp=5)]
    fake = FakeLlm(s.LlmDeferral(task_ids=["st-1-tk-1", "nope"], reason="容量"))
    ids = task_planning.defer_suggested(drafts, "g", [member("m1", capacity=6)], fake)
    assert ids == ["st-1-tk-1", "st-1-tk-2"]  # 依賴被延後任務的 Task 一起延後


def test_rebalance_only_moves_untouched_drafts() -> None:
    drafts = [
        draft(1, assignee="m1", suggested="m1"),  # 跟著 AI 建議 → 可調整
        draft(2, assignee="m2", suggested="m1"),  # Leader 改過 → 不動
        draft(3),  # 未指派 → 可調整
    ]
    fake = FakeLlm(
        s.LlmAssignments(
            assignments=[
                s.LlmAssignment(task_code="S-311", member_id="m2", reason="平衡"),
                s.LlmAssignment(task_code="S-312", member_id="m2", reason="不該被採用"),
                s.LlmAssignment(task_code="S-313", member_id="m1", reason="平衡"),
            ]
        )
    )
    updated = task_planning.rebalance(drafts, [member("m1"), member("m2")], fake)
    assert updated == 2
    assert (drafts[0].assignee_id, drafts[0].suggested_assignee_id) == ("m2", "m2")
    assert (drafts[1].assignee_id, drafts[1].suggested_assignee_id) == ("m2", "m1")  # 沒被動
    assert (drafts[2].assignee_id, drafts[2].suggested_assignee_id) == (None, "m1")
    # Leader 已鎖定的 m2 負載會告訴模型
    assert "已分配 3 點" in fake.calls[0][2]


def test_rebalance_without_members_is_conflict() -> None:
    with pytest.raises(ApiError) as e:
        task_planning.rebalance([draft(1)], [], FakeLlm())
    assert e.value.status == 409


# ---------- Sprint 分析 ----------


def test_analyze_questions_filters_and_limits() -> None:
    qs = [s.LlmQuestion(question=f"Q{i}", options=["a", "b"]) for i in range(8)]
    qs += [s.LlmQuestion(question="只有一個選項", options=["a"]), s.LlmQuestion(question=" ", options=["a", "b"])]
    out = sprint_ai.analyze_questions("紀錄", "目標", FakeLlm(s.LlmQuestions(questions=qs)))
    assert [q.id for q in out] == ["q-1", "q-2", "q-3", "q-4", "q-5"]
    assert all(q.answer == "" for q in out)
    with pytest.raises(ApiError):
        sprint_ai.analyze_questions("  ", "g", FakeLlm())


def test_analyze_dependencies_validates_ids_and_corrects_risk() -> None:
    current = [task("S-401"), task("S-402")]
    previous = [task("S-301", state="DONE"), task("S-302", state="IN_PROGRESS")]
    D = s.LlmTaskDependency
    fake = FakeLlm(
        s.LlmTaskDependencies(
            dependencies=[
                D(scope="prev", task_id="S-401", depends_on_id="S-301", reason="API", risk="high"),  # 已完成 → ok
                D(scope="prev", task_id="S-402", depends_on_id="S-302", reason="元件", risk="ok"),  # 未完成 → mid
                D(scope="prev", task_id="S-401", depends_on_id="S-301", reason="重複", risk="ok"),
                D(scope="same", task_id="S-402", depends_on_id="S-401", reason="同輪", risk="mid"),
                D(scope="same", task_id="S-402", depends_on_id="S-301", reason="scope 對不上", risk="mid"),
                D(scope="prev", task_id="ghost", depends_on_id="S-301", reason="不存在", risk="mid"),
                D(scope="same", task_id="S-401", depends_on_id="S-401", reason="自己", risk="mid"),
            ]
        )
    )
    out = sprint_ai.analyze_dependencies(current, previous, fake)
    assert [(d.task_id, d.depends_on_id, d.risk) for d in out] == [
        ("S-401", "S-301", "ok"),
        ("S-402", "S-302", "mid"),
        ("S-402", "S-401", "mid"),
    ]
    assert sprint_ai.analyze_dependencies([], previous, FakeLlm()) == []


# ---------- 執行計畫 ----------


def test_suggest_plan_clamps_dates_and_keeps_order() -> None:
    plan = s.LlmExecutionPlan(
        checklist=[
            s.LlmChecklistItem(text="準備", ac_index=None, day_offset=2),
            s.LlmChecklistItem(text="實作", ac_index=1, day_offset=1),  # 日期倒退
            s.LlmChecklistItem(text="驗收", ac_index=5, day_offset=99),  # 超出 Sprint、ac 不存在
            s.LlmChecklistItem(text=" ", ac_index=None, day_offset=0),
        ],
        checkpoints=[s.LlmCheckpoint(title="送審", day_offset=99), s.LlmCheckpoint(title="可展示", day_offset=3)],
        dep_checks=[s.LlmDepCheck(text="API 規格已定稿", source="openapi.yaml")],
    )
    out = execution_ai.suggest_plan(
        task(), [], [DocSnippet("a.md", "x")], date(2026, 11, 2), date(2026, 11, 6), FakeLlm(plan)
    )
    assert [c.id for c in out.checklist] == ["ck-1", "ck-2", "ck-3"]
    assert [c.due_at for c in out.checklist] == ["2026-11-04", "2026-11-04", "2026-11-06"]
    assert [c.ac_index for c in out.checklist] == [None, 1, None]
    assert [c.due_at for c in out.checkpoints] == ["2026-11-05", "2026-11-06"]
    assert out.origin == "ai" and out.confirmed_at is None and out.dep_checks[0].met is False


# ---------- 驗收檢查 ----------


def _delivery(provided=True, unfinished="- 手機版\n- 文件", questions="") -> Delivery:
    return Delivery(
        pr_url="https://github.com/o/r/pull/1",
        deliverables=[DeliverableItem(text="API", provided=True), DeliverableItem(text="文件", provided=provided)],
        test_note="手動測過",
        unfinished=unfinished,
        questions=questions,
        submitted_at="2026-11-05",
    )


def test_check_delivery_takes_facts_from_pr_not_model() -> None:
    llm_result = s.LlmAcceptance(
        items=[
            s.LlmAcItem(ac_index=1, verdict="met", evidence="模型說有測試"),
            s.LlmAcItem(ac_index=7, verdict="met", evidence="不存在的條件"),
        ],
        goal_match=[s.LlmGoalMatch(label="任務目標", verdict="met", detail="符合")],
        summary="摘要",
    )
    pr = PullRequest(number=1, status="open", tests="none", changed_files=["a.py"], summary=None)
    out = acceptance_ai.check_delivery(task(delivery=_delivery(provided=False), pr=pr), FakeLlm(llm_result))

    assert [i.ai for i in out.items] == ["unclear", "unclear"]  # 漏判的 → unclear；沒有測試結果卻說 met → unclear
    assert out.items[0].evidence.startswith("AI 沒有針對")
    assert out.deliverables_complete is False and out.missing_deliverables == ["文件"]
    assert out.tests == "none" and out.changed_files == ["a.py"]
    assert out.unfinished == ["手機版", "文件"]
    assert out.items[1].reviewer is None


def test_check_delivery_requires_delivery_and_criteria() -> None:
    with pytest.raises(ApiError) as e:
        acceptance_ai.check_delivery(task(delivery=None), FakeLlm())
    assert e.value.code == "NO_DELIVERY"
    with pytest.raises(ApiError) as e:
        acceptance_ai.check_delivery(task(acs=(), delivery=_delivery()), FakeLlm())
    assert e.value.code == "NO_ACCEPTANCE_CRITERIA"


# ---------- 專案脈絡助理 ----------


def test_chat_keeps_only_real_sources() -> None:
    fake = FakeLlm(s.LlmChat(answer=" 用 HMAC ", sources=["a.md", "編造.md", "a.md"], prompt_addition="  "))
    history = [ChatMessage(id="1", role="user", text="hi")]
    msg = chat_ai.ask(task(), "怎麼驗簽？", [DocSnippet("a.md", "內容")], history, fake)
    assert (msg.role, msg.text, msg.sources, msg.prompt_addition) == ("assistant", "用 HMAC", ["a.md"], None)
    assert "成員：hi" in fake.calls[0][2]
    with pytest.raises(ApiError):
        chat_ai.ask(task(), " ", [], [], fake)


# ---------- 路由 ----------


@pytest.fixture
def client():
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_generate_tasks_route(client) -> None:
    fake = FakeLlm(
        s.LlmTaskDraft(tasks=[llm_task(1, "A")]),
        s.LlmAssignments(assignments=[s.LlmAssignment(task_code="S-311", member_id="m1", reason="熟")]),
    )
    app.dependency_overrides[get_llm] = lambda: fake
    app.dependency_overrides[get_members] = lambda: [member("m1")]
    body = {"sprintId": 3, "stories": [story(1).model_dump(by_alias=True)], "existingTaskCount": 0}

    res = client.post("/api/planning/drafts/tasks", json=body)

    assert res.status_code == 200
    [t] = res.json()
    assert (t["code"], t["storyId"], t["suggestedAssigneeId"], t["assigneeId"]) == ("S-311", "st-1", "m1", None)
    assert t["branchSlug"] == "chat-api" and t["reviewer"] == {"mode": "pool", "memberId": None}


def test_story_assistant_route(client) -> None:
    app.dependency_overrides[get_llm] = lambda: FakeLlm(text="可以拆")
    res = client.post("/api/planning/drafts/chat", json={"question": "太大？", "storyTitle": None})
    assert res.status_code == 200 and res.json() == "可以拆"
