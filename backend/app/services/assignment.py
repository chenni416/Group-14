"""AI 指派建議：分配 Task 給成員（依技能與 capacity），或在協商退回時重新建議"""

from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmAssignments, LlmReassign
from app.schemas.member import Member
from app.schemas.planning import TaskDraft
from app.schemas.task import Task
from app.services._render import block, members_text, task_text


def _draft_text(t: TaskDraft, code_of: dict[str, str] | None = None) -> str:
    line = f"{t.code} | {t.domain} | {t.story_points} 點 | {t.title}"
    # [v0.2 修改] 附上相依（以任務編號表示），assign.md 的「相依鏈分散」步驟才有依據
    deps = [(code_of or {}).get(d.id, d.id) for d in t.depends_on]
    return f"{line} | 依賴：{', '.join(deps)}" if deps else line


def _flag_overload(
    drafts: list[TaskDraft], members: list[Member], loads: dict[str, int], out: dict[str, tuple[str, str]]
) -> None:
    """[v0.2 修改] 依 AI 的指派結果重新累計每人負載（含既有負載），超過 capacity 的在理由後註明。

    模型自己加總點數可能出錯，所以由程式驗算；不改動 AI 選的人，只提醒 Leader。
    累計順序與 assign.md 相同（點數大的先），超量提醒會標在「讓這位成員超過 capacity」的那幾張 Task。
    """
    cap = {m.id: m.capacity for m in members}
    total = dict(loads)
    for d in sorted(drafts, key=lambda x: -x.story_points):
        if d.code not in out:
            continue
        member_id, reason = out[d.code]
        total[member_id] = total.get(member_id, 0) + d.story_points
        if total[member_id] > cap.get(member_id, 0):
            note = f"（指派後共 {total[member_id]}/{cap.get(member_id, 0)} 點，超出 capacity，建議改派或延後）"
            out[d.code] = (member_id, f"{reason.rstrip('。')}{note}")


def suggest_assignments(
    drafts: list[TaskDraft], members: list[Member], llm: LlmClient, loads: dict[str, int] | None = None
) -> dict[str, tuple[str, str]]:
    """回傳 {task code: (member id, 理由)}。模型沒給或給了無效的 id，該 Task 就不在結果裡

    loads：這批 Task 之前每位成員已承擔的點數（上一輪帶入＋已確定的任務）。
    [v0.2 修改] 呼叫端現在都會傳入 loads；沒傳時視為 0（只建議用於測試）。
    """
    if not drafts or not members:
        return {}
    code_of = {d.id: d.code for d in drafts}
    result = llm.generate_json(
        system=load_prompt("assign"),
        user=block("members", members_text(members, loads))
        + "\n\n"
        + block("tasks", "\n".join(_draft_text(d, code_of) for d in drafts)),
        schema=LlmAssignments,
    )
    codes = {d.code for d in drafts}
    member_ids = {m.id for m in members}
    out: dict[str, tuple[str, str]] = {}
    for a in result.assignments:
        if a.task_code in codes and a.member_id in member_ids and a.task_code not in out:
            out[a.task_code] = (a.member_id, a.reason)
    _flag_overload(drafts, members, loads or {}, out)  # [v0.2 修改] 程式驗算 capacity
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
