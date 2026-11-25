"""[v0.3.1 修改] 依真實模型測試結果做的程式修正（tests/prompt_eval/EVAL_LOG.md 的 R4）"""

from app.ai import schemas as s
from app.services import assignment
from tests.prompt_eval.cases import C09_DRAFTS, C09_LOADS, MEMBERS


class FakeLlm:
    def __init__(self) -> None:
        self.user = ""

    def generate_json(self, *, system: str, user: str, schema):
        self.user = user
        return s.LlmAssignments(assignments=[])

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
