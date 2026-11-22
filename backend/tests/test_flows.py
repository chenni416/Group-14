"""AI 流程（資料層 + 引擎 + 路由）：用假的 LLM 與記憶體假資料驗證端對端行為"""

import pytest
from fastapi.testclient import TestClient

from app.ai import schemas as s
from app.ai.llm import get_llm
from app.main import app
from app.schemas.task import Negotiation
from tests.test_ai_services import FakeLlm, llm_task

LEADER = {"X-Demo-User": "m1"}  # 開發用假登入：Leader（main 的登入驗證不再預設身分）
OWNER_M3 = {"X-Demo-User": "m3"}  # S-212 的負責人
MEMBER_M4 = {"X-Demo-User": "m4"}


@pytest.fixture
def client():
    yield TestClient(app, headers=LEADER)
    app.dependency_overrides.pop(get_llm, None)


def use(fake: FakeLlm) -> FakeLlm:
    app.dependency_overrides[get_llm] = lambda: fake
    return fake


def story(title="任務內 AI 對話", **over) -> s.LlmStory:
    base = dict(
        title=title,
        user_story="身為成員…",
        story_points=5,
        scope=["對話 API", "前端介面"],
        rationale="同一情境",
        source_lines=[3],
        depends_on=[],
        clarify=[],
    )
    return s.LlmStory(**{**base, **over})


def planning_llm(**extra) -> FakeLlm:
    """decompose 會依序用到：分析問題、Story 切分、Task 拆解、指派、跨 Sprint 相依"""
    results = [
        s.LlmQuestions(questions=[s.LlmQuestion(question="Prompt 保留幾版？", options=["全部", "10 版"])]),
        s.LlmStoryDraft(stories=[story()]),
        s.LlmTaskDraft(
            tasks=[
                llm_task(1, "對話 API", story_points=3),
                llm_task(
                    1,
                    "對話介面",
                    domain="FE",
                    story_points=3,
                    deps=[s.LlmTaskDep(story_no=1, task_no=1, reason="先有 API")],
                ),
            ]
        ),
        s.LlmAssignments(
            assignments=[
                s.LlmAssignment(task_code="S-311", member_id="m2", reason="後端"),
                s.LlmAssignment(task_code="S-312", member_id="m1", reason="前端"),
            ]
        ),
        s.LlmTaskDependencies(
            dependencies=[
                s.LlmTaskDependency(
                    scope="prev", task_id="S-311", depends_on_id="S-212", reason="沿用拆解 Prompt", risk="mid"
                ),
                s.LlmTaskDependency(
                    scope="prev", task_id="S-312", depends_on_id="S-211", reason="上傳格式", risk="high"
                ),
            ]
        ),
        *extra.values(),
    ]
    return FakeLlm(*results)


def prepare_and_decompose(client, fake: FakeLlm) -> int:
    use(fake)
    assert client.post("/api/sprints/3/analyze", json={"minutes": "- Prompt 要能還原版本"}).json() == {"unanswered": 1}
    assert client.put("/api/sprints/3/questions/q-1", json={"answer": "全部"}).status_code == 200
    res = client.post("/api/sprints/3/decompose")
    assert res.status_code == 200, res.text
    return res.json()["created"]


# ---------- 分析與拆解 ----------


def test_analyze_saves_questions_and_keeps_answers(client, store) -> None:
    use(planning_llm())
    client.post("/api/sprints/3/analyze", json={"minutes": "紀錄"})
    client.put("/api/sprints/3/questions/q-1", json={"answer": "10 版"})

    res = client.post("/api/sprints/3/analyze", json={"minutes": "紀錄（更新）"})  # 重新分析

    assert res.json() == {"unanswered": 0}  # 相同問題保留先前的回答
    assert store.sprints[3].questions[0].answer == "10 版"
    assert store.sprints[3].minutes == "紀錄（更新）"


def test_leader_only_routes_reject_members(client) -> None:
    use(planning_llm())
    for method, url, body in [
        ("post", "/api/sprints/3/analyze", {"minutes": "x"}),
        ("put", "/api/sprints/3/questions/q-1", {"answer": "x"}),
        ("post", "/api/sprints/3/decompose", None),
        ("post", "/api/sprints/3/defer-suggested", None),
        ("post", "/api/sprints/3/rebalance", None),
        ("post", "/api/tasks/S-212/suggest-assignee", None),
    ]:
        res = getattr(client, method)(url, headers=MEMBER_M4, **({"json": body} if body else {}))
        assert res.status_code == 403, url
        assert res.json()["code"] == "FORBIDDEN"


def test_decompose_requires_analysis_and_answers(client) -> None:
    use(planning_llm())
    assert client.post("/api/sprints/3/decompose").json()["message"] == "請先按「AI 分析會議紀錄」"
    client.post("/api/sprints/3/analyze", json={"minutes": "紀錄"})
    assert client.post("/api/sprints/3/decompose").json()["message"] == "還有待釐清問題未回答，無法分配任務"


def test_decompose_creates_ai_draft_tasks_with_cross_sprint_dependencies(client, store) -> None:
    fake = planning_llm()
    created = prepare_and_decompose(client, fake)

    assert created == 2
    t1, t2 = store.tasks["S-311"], store.tasks["S-312"]
    assert (t1.state, t1.origin, t1.sprint_id, t1.assignee_id, t1.suggested_assignee_id) == (
        "AI_DRAFT",
        "ai",
        3,
        "m2",
        "m2",
    )
    assert t1.epic == "S3-1 任務內 AI 對話" and t1.acceptance_criteria == ["a1"]
    assert [d.id for d in t2.depends_on] == ["S-311"] + ["S-211"]  # 同 Sprint 相依 + 上一輪相依
    assert [d.id for d in t1.depends_on] == ["S-212"]
    assert store.sprints[3].step == 4
    # 已回答的釐清結果有帶進 AI 的輸入
    story_call = next(c for c in fake.calls if c[0] is s.LlmStoryDraft)
    assert "Prompt 保留幾版？ → 全部" in story_call[2]


def test_decompose_again_keeps_edited_tasks(client, store) -> None:
    prepare_and_decompose(client, planning_llm())
    store.tasks["S-311"].edited = True
    store.tasks["S-311"].title = "Leader 改過的標題"

    use(planning_llm())
    assert client.post("/api/sprints/3/decompose").json() == {"created": 1}  # 只重做沒被改過的 S-312
    assert store.tasks["S-311"].title == "Leader 改過的標題"
    assert set(t.id for t in store.sprint_tasks(3)) == {"S-311", "S-312"}


def test_dependencies_reads_task_links_and_computes_risk(client, store) -> None:
    prepare_and_decompose(client, planning_llm())

    deps = client.get("/api/sprints/3/dependencies").json()

    got = {(d["taskId"], d["dependsOnId"]): (d["scope"], d["risk"]) for d in deps}
    assert got == {
        ("S-311", "S-212"): ("prev", "mid"),  # 上一輪還在 In Review
        ("S-312", "S-211"): ("prev", "ok"),  # 上一輪已完成
        ("S-312", "S-311"): ("same", "mid"),
    }
    assert [d["risk"] for d in deps][0] == "mid"  # 高風險優先排序（沒有 high 時 mid 在前）
    store.tasks["S-311"].state = "DEFERRED"
    risks = {(d["taskId"], d["dependsOnId"]): d["risk"] for d in client.get("/api/sprints/3/dependencies").json()}
    assert risks[("S-312", "S-311")] == "high"  # 前置任務被延後 → 高風險


# ---------- 延後與重新平衡 ----------


def test_defer_suggested_defers_and_records_backlog(client, store) -> None:
    prepare_and_decompose(client, planning_llm())
    store.sprints[3].capacity = {"m1": 2, "m2": 2}  # 總容量 4 < 6 點
    use(FakeLlm(s.LlmDeferral(task_ids=["S-312"], reason="容量")))

    res = client.post("/api/sprints/3/defer-suggested")

    assert res.json() == {"deferred": 1}
    assert store.tasks["S-312"].state == "DEFERRED" and store.tasks["S-312"].prev_state == "AI_DRAFT"
    assert store.backlog[-1].task_id == "S-312" and store.backlog[-1].from_sprint == "Sprint 3"


def test_rebalance_skips_edited_tasks(client, store) -> None:
    prepare_and_decompose(client, planning_llm())
    store.tasks["S-312"].edited = True  # Leader 動過 → 不能被改
    use(FakeLlm(s.LlmAssignments(assignments=[s.LlmAssignment(task_code="S-311", member_id="m3", reason="平衡")])))

    res = client.post("/api/sprints/3/rebalance")

    assert res.json() == {"updated": 1}
    assert (store.tasks["S-311"].assignee_id, store.tasks["S-311"].suggest_reason) == ("m3", "平衡")
    assert store.tasks["S-312"].assignee_id == "m1"


# ---------- 協商退回：重新建議負責人 ----------


def test_suggest_assignee_excludes_negotiator_and_computes_fit(client, store) -> None:
    prepare_and_decompose(client, planning_llm())
    store.tasks["S-311"].negotiation = Negotiation(by_id="m2", reason="這輪要支援 Demo", suggest_id=None)
    fake = use(FakeLlm(s.LlmReassign(member_id="m3", reason="熟悉後端 API", fits=False)))

    res = client.post("/api/tasks/S-311/suggest-assignee")

    assert res.status_code == 200
    body = res.json()
    assert body["fits"] is True  # 由程式依 capacity 計算（m3 容量 8、尚未分配）
    assert body["task"]["assigneeId"] == "m3" and body["task"]["edited"] is True
    assert "已排除提出協商的 林柏翰" in body["task"]["suggestReason"]
    assert "m2 |" not in fake.calls[0][2]  # 提出協商的人不在候選名單


def test_suggest_assignee_without_candidates_is_error(client, store) -> None:
    prepare_and_decompose(client, planning_llm())
    store.tasks["S-311"].negotiation = Negotiation(by_id="m2", reason="x", suggest_id=None)
    use(FakeLlm(s.LlmReassign(member_id="ghost", reason="編造的成員", fits=True)))

    res = client.post("/api/tasks/S-311/suggest-assignee")

    assert res.status_code == 400 and res.json()["message"] == "沒有可指派的成員"


# ---------- 執行計畫、驗收檢查 ----------


def plan_result() -> s.LlmExecutionPlan:
    return s.LlmExecutionPlan(
        checklist=[s.LlmChecklistItem(text="實作", ac_index=0, day_offset=1)],
        checkpoints=[s.LlmCheckpoint(title="送審", day_offset=3)],
        dep_checks=[],
    )


def test_execution_plan_suggest_saves_draft_for_owner(client, store) -> None:
    use(FakeLlm(plan_result()))

    res = client.post("/api/tasks/S-212/execution-plan/suggest", headers=OWNER_M3)

    assert res.status_code == 200
    body = res.json()
    assert body["taskId"] == "S-212" and body["origin"] == "ai" and body["confirmedAt"] is None
    assert "S-212" in store.plans
    assert client.post("/api/tasks/S-212/execution-plan/suggest", headers=MEMBER_M4).status_code == 403
    store.plans["S-212"].confirmed_at = "2026-11-05"
    assert client.post("/api/tasks/S-212/execution-plan/suggest", headers=OWNER_M3).status_code == 409


def test_acceptance_check_on_seed_delivery(client) -> None:
    use(
        FakeLlm(
            s.LlmAcceptance(
                items=[
                    s.LlmAcItem(ac_index=0, verdict="met", evidence="schema 已附"),
                    s.LlmAcItem(ac_index=1, verdict="met", evidence="說有"),
                    s.LlmAcItem(ac_index=2, verdict="met", evidence="測試通過"),
                ],
                goal_match=[s.LlmGoalMatch(label="任務目標", verdict="met", detail="符合")],
                summary="摘要",
            )
        )
    )

    res = client.post("/api/tasks/S-212/acceptance/check")

    assert res.status_code == 200
    body = res.json()
    assert body["missingDeliverables"] == ["10 筆測試案例與評估結果"] and body["deliverablesComplete"] is False
    assert body["tests"] == "passed" and body["changedFiles"] == ["app/ai/prompts/decompose.md"]
    assert [i["ai"] for i in body["items"]] == ["met", "met", "met"]
    assert client.post("/api/tasks/S-222/acceptance/check").json()["code"] == "NO_DELIVERY"


# ---------- Living Prompt 與專案脈絡助理 ----------


def chat_result(addition="sources 為文件名稱陣列") -> s.LlmChat:
    return s.LlmChat(answer="放引用文件名稱", sources=["openapi.yaml", "不存在.md"], prompt_addition=addition)


def test_studio_is_owner_only(client) -> None:
    use(FakeLlm(chat_result()))
    for method, url, body in [
        ("get", "/api/tasks/S-212/prompt", None),
        ("put", "/api/tasks/S-212/prompt/current", {"version": 0}),
        ("get", "/api/tasks/S-212/chat", None),
        ("post", "/api/tasks/S-212/chat", {"question": "hi"}),
    ]:
        res = getattr(client, method)(url, headers=MEMBER_M4, **({"json": body} if body else {}))
        assert res.status_code == 403, url


def test_chat_ask_grows_prompt_versions_and_switching_back(client) -> None:
    use(FakeLlm(chat_result()))
    first = client.get("/api/tasks/S-212/prompt", headers=OWNER_M3).json()
    assert len(first["versions"]) == 1 and first["current"] == 0
    assert client.get("/api/tasks/S-212/chat", headers=OWNER_M3).json()[0]["id"] == "greeting"

    msg = client.post("/api/tasks/S-212/chat", json={"question": "sources 要放什麼？"}, headers=OWNER_M3).json()

    assert msg["sources"] == ["openapi.yaml"]  # 編造的文件名稱被丟掉
    assert msg["promptAddition"] == "sources 為文件名稱陣列" and msg["promptVersion"] == 2
    state = client.get("/api/tasks/S-212/prompt", headers=OWNER_M3).json()
    assert len(state["versions"]) == 2 and state["current"] == 1
    assert "- sources 為文件名稱陣列" in state["versions"][1] and "- sources 為文件名稱陣列" not in state["versions"][0]
    chat = client.get("/api/tasks/S-212/chat", headers=OWNER_M3).json()
    assert [m["role"] for m in chat] == ["assistant", "user", "assistant"]

    back = client.put("/api/tasks/S-212/prompt/current", json={"version": 0}, headers=OWNER_M3).json()
    assert back["current"] == 0
    assert client.put("/api/tasks/S-212/prompt/current", json={"version": 99}, headers=OWNER_M3).json()["current"] == 1

    # 回到舊版本後再問：新版本從舊版本長出來，捨棄之後的版本
    client.put("/api/tasks/S-212/prompt/current", json={"version": 0}, headers=OWNER_M3)
    use(FakeLlm(chat_result("另一個決定")))
    client.post("/api/tasks/S-212/chat", json={"question": "另一題"}, headers=OWNER_M3)
    state = client.get("/api/tasks/S-212/prompt", headers=OWNER_M3).json()
    assert len(state["versions"]) == 2 and "- 另一個決定" in state["versions"][1]
    assert "- sources 為文件名稱陣列" not in state["versions"][1]


def test_chat_failure_leaves_no_half_conversation(client, store) -> None:
    class Broken(FakeLlm):
        def generate_json(self, **_kwargs):
            raise RuntimeError("boom")

    use(Broken())
    with pytest.raises(RuntimeError):
        client.post("/api/tasks/S-212/chat", json={"question": "hi"}, headers=OWNER_M3)
    assert [m.role for m in store.thread("S-212").chat] == ["assistant"]  # 只有問候，沒有孤立的使用者訊息
