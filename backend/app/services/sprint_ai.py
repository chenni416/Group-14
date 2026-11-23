"""Sprint 層級的 AI 分析：待釐清問題、跨 Sprint 相依性"""

from app.ai import audit
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmQuestions, LlmTaskDependencies
from app.core.errors import ApiError
from app.schemas.sprint import ClarifyQuestion, Dependency
from app.schemas.task import Task
from app.services._render import block, task_text
from app.services.planning import MAX_MINUTES_CHARS

MAX_QUESTIONS = 5


def analyze_questions(minutes: str, goal: str, llm: LlmClient) -> list[ClarifyQuestion]:
    text = minutes.strip()
    if not text:
        raise ApiError("請先填寫會議紀錄")
    if len(text) > MAX_MINUTES_CHARS:
        raise ApiError(f"會議紀錄過長（上限 {MAX_MINUTES_CHARS} 字）", status=413)
    result = llm.generate_json(
        system=load_prompt("clarify_questions"),
        user=block("sprint_goal", goal) + "\n\n" + block("meeting_minutes", text),
        schema=LlmQuestions,
    )
    questions = [q for q in result.questions if q.question.strip() and len(q.options) >= 2]
    dropped = [q.question for q in result.questions if not (q.question.strip() and len(q.options) >= 2)]
    if dropped:
        audit.note("drop_invalid_questions", f"捨棄空白或選項少於 2 個的待釐清問題：{dropped}", dropped=dropped)
    if len(questions) > MAX_QUESTIONS:
        cut = [q.question for q in questions[MAX_QUESTIONS:]]
        audit.note(
            "truncate_questions", f"問題超過 {MAX_QUESTIONS} 個，只保留前 {MAX_QUESTIONS} 個，捨棄：{cut}", dropped=cut
        )
    return [
        ClarifyQuestion(id=f"q-{i}", question=q.question.strip(), options=q.options, answer="")
        for i, q in enumerate(questions[:MAX_QUESTIONS], start=1)
    ]


def analyze_dependencies(current: list[Task], previous: list[Task], llm: LlmClient) -> list[Dependency]:
    if not current:
        return []
    result = llm.generate_json(
        system=load_prompt("task_dependencies"),
        user=block("current_sprint_tasks", "\n\n".join(map(task_text, current)))
        + "\n\n"
        + block("previous_sprint_tasks", "\n\n".join(map(task_text, previous))),
        schema=LlmTaskDependencies,
    )
    now = {t.id for t in current}
    prev = {t.id for t in previous}
    prev_done = {t.id for t in previous if t.state == "DONE"}
    out: list[Dependency] = []
    seen: set[tuple[str, str]] = set()
    for d in result.dependencies:
        target_ok = d.depends_on_id in (prev if d.scope == "prev" else now)
        if (
            d.task_id not in now
            or not target_ok
            or d.task_id == d.depends_on_id
            or (d.task_id, d.depends_on_id) in seen
        ):
            if d.task_id not in now:
                why = "task_id 不在本 Sprint"
            elif not target_ok:
                why = "被依賴的任務不存在於指定範圍"
            elif d.task_id == d.depends_on_id:
                why = "依賴自己"
            else:
                why = "重複的相依"
            audit.note(
                "drop_dependency",
                f"捨棄相依 {d.task_id} → {d.depends_on_id}：{why}",
                task=d.task_id,
                depends_on=d.depends_on_id,
            )
            continue
        seen.add((d.task_id, d.depends_on_id))
        # 風險由程式校正：上一輪已完成的不會是 high，沒完成的不可能是 ok
        risk = d.risk
        if d.scope == "prev":
            if d.depends_on_id in prev_done and risk == "high":
                risk = "ok"
            elif d.depends_on_id not in prev_done and risk == "ok":
                risk = "mid"
        if risk != d.risk:
            audit.note(
                "adjust_risk",
                f"{d.task_id} → {d.depends_on_id}：風險 {d.risk} 校正為 {risk}（依前置任務是否已完成）",
                task=d.task_id,
                depends_on=d.depends_on_id,
                raw=d.risk,
                adjusted=risk,
            )
        out.append(
            Dependency(scope=d.scope, task_id=d.task_id, depends_on_id=d.depends_on_id, reason=d.reason, risk=risk)
        )
    return out
