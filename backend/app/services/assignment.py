"""AI 指派建議：分配 Task 給成員（依技能與 capacity），或在協商退回時重新建議"""

from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmAssignments, LlmReassign
from app.schemas.member import Member
from app.schemas.planning import TaskDraft
from app.schemas.task import Task
from app.services._render import block, members_text, task_text


def _draft_text(t: TaskDraft) -> str:
    return f"{t.code} | {t.domain} | {t.story_points} 點 | {t.title}"


def suggest_assignments(
    drafts: list[TaskDraft], members: list[Member], llm: LlmClient, loads: dict[str, int] | None = None
) -> dict[str, tuple[str, str]]:
    """回傳 {task code: (member id, 理由)}。模型沒給或給了無效的 id，該 Task 就不在結果裡"""
    if not drafts or not members:
        return {}
    result = llm.generate_json(
        system=load_prompt("assign"),
        user=block("members", members_text(members, loads))
        + "\n\n"
        + block("tasks", "\n".join(map(_draft_text, drafts))),
        schema=LlmAssignments,
    )
    codes = {d.code for d in drafts}
    member_ids = {m.id for m in members}
    out: dict[str, tuple[str, str]] = {}
    for a in result.assignments:
        if a.task_code in codes and a.member_id in member_ids and a.task_code not in out:
            out[a.task_code] = (a.member_id, a.reason)
    return out


def suggest_reassignment(
    task: Task, members: list[Member], excluded: set[str], loads: dict[str, int], reason: str, llm: LlmClient
) -> tuple[str, str, bool] | None:
    """協商退回後重新建議負責人。回傳 (member id, 理由, 是否塞得下)；沒有合適人選回傳 None"""
    candidates = [m for m in members if m.id not in excluded]
    if not candidates:
        return None
    result = llm.generate_json(
        system=load_prompt("reassign"),
        user=block("members", members_text(candidates, loads))
        + "\n\n"
        + block("task", task_text(task))
        + "\n\n"
        + block("negotiation_reason", reason),
        schema=LlmReassign,
    )
    if result.member_id not in {m.id for m in candidates}:
        return None
    member = next(m for m in candidates if m.id == result.member_id)
    # 是否塞得下由程式依 capacity 計算，不採信模型的 fits
    fits = loads.get(member.id, 0) + task.story_points <= member.capacity
    return result.member_id, result.reason, fits
