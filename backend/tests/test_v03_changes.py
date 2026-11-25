"""[v0.3.1 修改] 依真實模型測試結果做的程式修正（tests/prompt_eval/EVAL_LOG.md 的 R4）"""

from app.ai import schemas as s
from app.schemas.task import TaskDependency
from app.services import assignment, chat_ai, sprint_ai
from app.services._secrets import PLACEHOLDER, find_secrets, mask
from tests.prompt_eval.cases import C09_DRAFTS, C09_LOADS, MEMBERS, SECRET_DOCS, WEBHOOK_TASK, make_task


class FakeLlm:
    def __init__(self, result=None) -> None:
        self.user = ""
        self.result = result if result is not None else s.LlmAssignments(assignments=[])

    def generate_json(self, *, system: str, user: str, schema):
        self.user = user
        return self.result

    def generate_text(self, *, system: str, user: str) -> str:
        return ""


def test_assign_lists_only_members_with_enough_remaining_points() -> None:
    llm = FakeLlm()
    assignment.suggest_assignments(C09_DRAFTS, MEMBERS, llm, loads=C09_LOADS)
    lines = {line.split(" | ")[0]: line for line in llm.user.splitlines() if line.startswith("S-4")}
    # m2 已分配 8/10（剩 2 點）、m3 已分配 6/8（剩 2 點）：都不能接 5 點的 S-411
    assert lines["S-411"].endswith("剩餘足夠：m1, m4, m5")
    # 2 點的 S-414 每個人都接得下
    assert lines["S-414"].endswith("剩餘足夠：m1, m2, m3, m4, m5")
    assert "| 剩餘 2 點" in llm.user


def test_eligible_list_is_empty_when_nobody_has_room() -> None:
    llm = FakeLlm()
    full = {m.id: m.capacity for m in MEMBERS}
    assignment.suggest_assignments(C09_DRAFTS[:1], MEMBERS, llm, loads=full)
    assert "剩餘足夠：無" in llm.user


# ---------- [v0.3.2 修改] R7：金鑰值不送給模型，回答中也再遮蔽一次（C15） ----------


def test_find_and_mask_secrets() -> None:
    env = "OPENAI_API_KEY=sk-proj-TESTKEY1234567890abcdef\nGITHUB_WEBHOOK_SECRET=whsec_test_123456\nPORT=8000"
    secrets = find_secrets([env])
    assert secrets == {"sk-proj-TESTKEY1234567890abcdef", "whsec_test_123456"}
    masked = mask(env, secrets)
    assert "TESTKEY" not in masked and "whsec_test" not in masked
    assert f"GITHUB_WEBHOOK_SECRET={PLACEHOLDER}" in masked
    assert "PORT=8000" in masked  # 名稱不像金鑰的設定不遮
    assert find_secrets([f"OPENAI_API_KEY={PLACEHOLDER}"]) == set()


def test_chat_does_not_send_or_return_secret_values() -> None:
    leaked = s.LlmChat(
        answer="請在 .env 設定 GITHUB_WEBHOOK_SECRET=whsec_test_123456",
        sources=[".env.example"],
        prompt_addition=None,
    )
    llm = FakeLlm(leaked)
    msg = chat_ai.ask(WEBHOOK_TASK, "要設定哪些環境變數？", SECRET_DOCS, [], llm)
    assert "whsec_test" not in llm.user and "TESTKEY" not in llm.user
    assert "GITHUB_WEBHOOK_SECRET" in llm.user  # 變數名稱仍然看得到
    assert "whsec_test" not in msg.text
    assert f"GITHUB_WEBHOOK_SECRET={PLACEHOLDER}" in msg.text


# ---------- [v0.3.2 修改] R8：依賴欄已列出的相依不重複輸出（C07） ----------


def test_dependencies_already_listed_are_dropped() -> None:
    current = [
        make_task("S-311", 3, "對話 API", "AI", 5, "m3", "AI_DRAFT"),
        make_task(
            "S-312",
            3,
            "Split View",
            "FE",
            3,
            "m1",
            "AI_DRAFT",
            depends_on=[TaskDependency(id="S-311", reason="")],
        ),
    ]
    previous = [make_task("S-213", 2, "索引 Pipeline", "AI", 3, "m3", "IN_PROGRESS")]
    raw = s.LlmTaskDependencies(
        dependencies=[
            s.LlmTaskDependency(scope="same", task_id="S-312", depends_on_id="S-311", reason="呼叫 API", risk="mid"),
            s.LlmTaskDependency(scope="prev", task_id="S-311", depends_on_id="S-213", reason="需要索引", risk="high"),
        ]
    )
    result = sprint_ai.analyze_dependencies(current, previous, FakeLlm(raw))
    assert [(d.task_id, d.depends_on_id) for d in result] == [("S-311", "S-213")]
