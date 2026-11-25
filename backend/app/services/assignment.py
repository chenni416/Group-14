"""AI 指派建議：分配 Task 給成員（依技能與 capacity），或在協商退回時重新建議"""

from app.ai import audit
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmAssignments, LlmReassign
from app.schemas.member import Member
from app.schemas.planning import TaskDraft
from app.schemas.task import Task
from app.services._render import block, members_text, task_text


def _draft_text(t: TaskDraft, code_of: dict[str, str] | None = None, eligible: list[str] | None = None) -> str:
    line = f"{t.code} | {t.domain} | {t.story_points} 點 | {t.title}"
    # [v0.2 修改] 附上相依（以任務編號表示），assign.md 的「相依鏈分散」步驟才有依據
    deps = [(code_of or {}).get(d.id, d.id) for d in t.depends_on]
    if deps:
        line += f" | 依賴：{', '.join(deps)}"
    if eligible is not None:
        # [v0.3.1 修改] 列出剩餘點數足夠的成員，模型只能從中選（prompt 測試 C09，R4）
        line += f" | 剩餘足夠：{', '.join(eligible) or '無'}"
    return line


def _eligible(t: TaskDraft, members: list[Member], loads: dict[str, int]) -> list[str]:
    """[v0.3.1 修改] 指派前剩餘點數（capacity − 已分配）足以承接這張 Task 的成員 id"""
    return [m.id for m in members if m.capacity - loads.get(m.id, 0) >= t.story_points]


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
            audit.note(
                "flag_overload",
                f"{d.code} 指派給 {member_id} 後共 {total[member_id]}/{cap.get(member_id, 0)} 點，理由已註明超出",
                task=d.code,
                member=member_id,
                total=total[member_id],
                capacity=cap.get(member_id, 0),
            )
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
        + block("tasks", "\n".join(_draft_text(d, code_of, _eligible(d, members, loads or {})) for d in drafts)),
        schema=LlmAssignments,
    )
    codes = {d.code for d in drafts}
    member_ids = {m.id for m in members}
    out: dict[str, tuple[str, str]] = {}
    for a in result.assignments:
        if a.task_code in codes and a.member_id in member_ids and a.task_code not in out:
            out[a.task_code] = (a.member_id, a.reason)
        else:
            if a.task_code not in codes:
                why = "任務編號不存在"
            elif a.member_id not in member_ids:
                why = "成員 id 不存在"
            else:
                why = "同一個任務重複指派"
            audit.note(
                "drop_assignment",
                f"捨棄指派 {a.task_code} → {a.member_id}：{why}",
                task=a.task_code,
                member=a.member_id,
            )
    missing = sorted(codes - out.keys())
    if missing:
        audit.note("unassigned_tasks", f"模型沒有給出有效指派的任務：{missing}", tasks=missing)
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
        audit.note("drop_reassignment", f"捨棄改派建議：成員 {result.member_id} 不在候選名單", member=result.member_id)
        return None
    member = next(m for m in candidates if m.id == result.member_id)
    # 是否塞得下由程式依 capacity 計算，不採信模型的 fits
    fits = loads.get(member.id, 0) + task.story_points <= member.capacity
    if fits != result.fits:
        audit.note(
            "recompute_fits",
            f"模型回報 fits={result.fits}，程式依 capacity 重算為 {fits}",
            model=result.fits,
            computed=fits,
        )
    return result.member_id, result.reason, fits
