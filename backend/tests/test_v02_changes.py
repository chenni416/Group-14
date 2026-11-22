"""[v0.2 修改] 的測試：既有負載、釐清回答傳遞、Story 助理收到 Story、Task 點數上限 8、temperature"""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.ai import schemas as s
from app.ai.llm import OpenAILlm, get_llm
from app.main import app
from app.repo.seed import build_seed
from app.schemas.member import Member
from app.schemas.planning import GenerateTasksInput, ReviewerAssignment, StoryClarifyItem, StoryDraft, TaskDraft
from app.services import task_planning


class FakeLlm:
    def __init__(self, *results, text: str = "ok") -> None:
        self.results = {type(r): r for r in results}
        self.text = text
        self.calls: list[tuple[type, str]] = []

    def generate_json(self, *, system: str, user: str, schema):
        self.calls.append((schema, user))
        return self.results[schema]

    def generate_text(self, *, system: str, user: str) -> str:
        self.calls.append((str, user))
        return self.text

    def user_for(self, schema) -> str:
        return next(u for sc, u in self.calls if sc is schema)


def member(id: str, capacity: int = 10, domain: str = "BE") -> Member:
    return Member(
        id=id,
        name=id.upper(),
        email=f"{id}@x.com",
        role="Member",
        title="Engineer",
        domain=domain,
        tags=["Python"],
        capacity=capacity,
    )


def story(no: int = 1, clarify=None, deferred=None) -> StoryDraft:
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
        clarify=clarify,
        deferred=deferred,
    )


def llm_task(points: int = 3) -> s.LlmTask:
    return s.LlmTask(
        story_no=1,
        title="T",
        domain="BE",
        branch_prefix="feat",
        branch_slug="t-api",
        story_points=points,
        acceptance_criteria=["a"],
        analysis="x",
        reviewer_mode="pool",
        depends_on=[],
    )


# ---------- 1. 既有負載 ----------


def test_carry_load_counts_only_carried_unfinished_tasks() -> None:
    store = build_seed()
    store.tasks["S-213"].carry, store.tasks["S-213"].carry_points = True, 2  # m3，IN_PROGRESS，重新評估為 2 點
    store.tasks["S-231"].carry, store.tasks["S-231"].carry_assignee_id = True, "m1"  # 改由 m1 接手，沿用 2 點
    store.tasks["S-211"].carry = True  # 已完成：不算
    store.tasks["S-222"].carry = False  # 決定延後：不算

    assert store.carry_load(3) == {"m3": 2, "m1": 2}
    assert store.planned_load(3) == {"m3": 2, "m1": 2}
    assert store.carry_load(2) == {}  # Sprint 2 沒有上一輪


def test_committed_load_excludes_planning_drafts() -> None:
    store = build_seed()
    store.tasks["S-213"].carry = True
    store.tasks["S-221"].sprint_id = 3  # 本輪已確定的任務（IN_REVIEW，m1，3 點）
    store.tasks["S-232"].sprint_id, store.tasks["S-232"].state = 3, "AI_DRAFT"  # 草稿：不算
    assert store.committed_load(3) == {"m3": 3, "m1": 3}


def test_generate_tasks_sends_loads_and_flags_overload() -> None:
    llm = FakeLlm(
        s.LlmTaskDraft(tasks=[llm_task(3)]),
        s.LlmAssignments(assignments=[s.LlmAssignment(task_code="S-311", member_id="m1", reason="技能吻合。")]),
    )
    [d] = task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=3, stories=[story()], existing_task_count=0),
        [member("m1", capacity=5)],
        llm,
        loads={"m1": 4},
    )
    assert "已分配 4 點" in llm.user_for(s.LlmAssignments)
    assert d.suggested_assignee_id == "m1"
    assert d.assign_reason == "技能吻合（指派後共 7/5 點，超出 capacity，建議改派或延後）"


def test_assign_prompt_lists_dependencies_by_code() -> None:
    dependent = llm_task().model_copy(update={"depends_on": [s.LlmTaskDep(story_no=1, task_no=1, reason="r")]})
    llm = FakeLlm(
        s.LlmTaskDraft(tasks=[llm_task(), dependent]),
        s.LlmAssignments(assignments=[]),
    )
    task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=3, stories=[story()], existing_task_count=0), [member("m1")], llm
    )
    assert "S-312 | BE | 3 點 | T | 依賴：S-311" in llm.user_for(s.LlmAssignments)


def test_defer_counts_committed_points() -> None:
    drafts = [
        TaskDraft(
            id="st-1-tk-1",
            story_id="st-1",
            no=1,
            code="S-311",
            title="A",
            domain="BE",
            branch_prefix="feat",
            branch_slug="a",
            story_points=3,
            acceptance_criteria=[],
            assignee_id=None,
            suggested_assignee_id=None,
            reviewer=ReviewerAssignment(mode="pool", member_id=None),
            analysis="",
            assign_reason="",
            depends_on=[],
        )
    ]
    members = [member("m1", capacity=5)]
    assert task_planning.defer_suggested(drafts, "g", members, FakeLlm()) == []  # 只看草稿：3 ≤ 5
    llm = FakeLlm(s.LlmDeferral(task_ids=["st-1-tk-1"], reason="r"))
    assert task_planning.defer_suggested(drafts, "g", members, llm, committed=4) == ["st-1-tk-1"]
    assert "其中 4 點為上一輪帶入與已確定的任務" in llm.user_for(s.LlmDeferral)


# ---------- 2. 釐清回答傳給拆 Task ----------


def test_generate_tasks_receives_clarify_answers() -> None:
    clarify = [
        StoryClarifyItem(
            id="cq-1",
            kind="question",
            text="退回後誰要重審？",
            options=["全部", "退回者"],
            effect="全員同意模式退回後：{answer}",
            answer="全部重新審查",
        ),
        StoryClarifyItem(
            id="cq-2", kind="suggestion", text="Webhook 拆成獨立 Task", effect="拆成獨立 Task", decision="accept"
        ),
        StoryClarifyItem(id="cq-3", kind="suggestion", text="不採用的建議", effect="不要出現", decision="reject"),
        StoryClarifyItem(id="cq-4", kind="question", text="還沒回答的問題", options=["a", "b"], effect="x：{answer}"),
    ]
    llm = FakeLlm(s.LlmTaskDraft(tasks=[llm_task()]))
    task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=3, stories=[story(clarify=clarify)], existing_task_count=0),
        [],
        llm,
        sprint_answers=["提醒門檻？ → 24 小時"],
    )
    user = llm.user_for(s.LlmTaskDraft)
    assert "已釐清：退回後誰要重審？ → 全部重新審查（驗收條件：全員同意模式退回後：全部重新審查）" in user
    assert "採用建議：Webhook 拆成獨立 Task（拆成獨立 Task）" in user
    assert "不採用的建議" not in user and "還沒回答的問題" not in user
    assert "<clarifications>\n- 提醒門檻？ → 24 小時\n</clarifications>" in user


# ---------- 3. Story 助理收到 Story ----------


def test_story_assistant_route_sends_stories() -> None:
    fake = FakeLlm(text="建議拆成兩個")
    app.dependency_overrides[get_llm] = lambda: fake
    try:
        body = {
            "question": "太大？",
            "storyTitle": "Story 1",
            "stories": [story(1).model_dump(by_alias=True), story(2, deferred=True).model_dump(by_alias=True)],
        }
        res = TestClient(app).post("/api/planning/drafts/chat", json=body)
    finally:
        app.dependency_overrides.pop(get_llm, None)
    assert res.status_code == 200 and res.json() == "建議拆成兩個"
    user = fake.calls[0][1]
    assert "Story no=1｜Story 1" in user and "Story no=2" not in user  # 延後的 Story 不送


# ---------- 4. Task 點數上限 8 ----------


@pytest.mark.parametrize(("raw", "expected"), [(0, 1), (1, 1), (4, 5), (8, 8), (13, 8), (99, 8)])
def test_task_points_snap_to_options(raw: int, expected: int) -> None:
    assert task_planning._snap_points(raw) == expected


# ---------- 5. temperature ----------


def _fake_openai(captured: dict):
    def parse(**kwargs):
        captured["parse"] = kwargs
        msg = SimpleNamespace(refusal=None, parsed=s.LlmDeferral(task_ids=[], reason="r"))
        return SimpleNamespace(choices=[SimpleNamespace(message=msg)], usage=None)

    def create(**kwargs):
        captured["create"] = kwargs
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))], usage=None)

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse, create=create)))


def test_openai_llm_sends_temperature() -> None:
    captured: dict = {}
    llm = OpenAILlm(_fake_openai(captured), "gpt-4.1", temperature=0.2, text_temperature=0.5)
    llm.generate_json(system="s", user="u", schema=s.LlmDeferral)
    llm.generate_text(system="s", user="u")
    assert captured["parse"]["temperature"] == 0.2 and captured["create"]["temperature"] == 0.5


def test_openai_llm_omits_temperature_when_unset() -> None:
    captured: dict = {}
    OpenAILlm(_fake_openai(captured), "o-model").generate_json(system="s", user="u", schema=s.LlmDeferral)
    assert "temperature" not in captured["parse"]
