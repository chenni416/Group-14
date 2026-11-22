"""G3：AI 依任務規格、相依任務與專案文件產生執行計畫草稿"""

from datetime import date, timedelta

from app.ai.context import DocSnippet
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmExecutionPlan
from app.schemas.collab import ChecklistItem, Checkpoint, DepCheck, ExecutionPlan
from app.schemas.task import Task
from app.services._render import block, task_text


def docs_text(docs: list[DocSnippet]) -> str:
    return "\n\n".join(f"[{d.name}]\n{d.text}" for d in docs)


def suggest_plan(
    task: Task, dep_tasks: list[Task], docs: list[DocSnippet], start: date, end: date, llm: LlmClient
) -> ExecutionPlan:
    max_offset = max((end - start).days, 0)
    schedule = f"開始日 {start.isoformat()}，Sprint 結束日 {end.isoformat()}，max_day_offset={max_offset}"
    result = llm.generate_json(
        system=load_prompt("execution_plan"),
        user=block("task", task_text(task))
        + "\n\n"
        + block("dependency_tasks", "\n\n".join(map(task_text, dep_tasks)))
        + "\n\n"
        + block("project_docs", docs_text(docs))
        + "\n\n"
        + block("schedule", schedule),
        schema=LlmExecutionPlan,
    )

    def due(offset: int) -> str:
        return (start + timedelta(days=min(max(offset, 0), max_offset))).isoformat()

    n_ac = len(task.acceptance_criteria)
    checklist = [
        ChecklistItem(
            id=f"ck-{n}",
            text=i.text.strip(),
            done=False,
            ac_index=i.ac_index if i.ac_index is not None and 0 <= i.ac_index < n_ac else None,
            due_at=due(i.day_offset),
        )
        for n, i in enumerate((i for i in result.checklist if i.text.strip()), start=1)
    ]
    # 日期要依步驟順序遞增，避免模型給出前後顛倒的日期
    latest = ""
    for item in checklist:
        if item.due_at and item.due_at < latest:
            item.due_at = latest
        latest = item.due_at or latest
    checkpoints = [
        Checkpoint(id=f"cp-{n}", title=c.title.strip(), due_at=due(c.day_offset), reached_at=None)
        for n, c in enumerate((c for c in result.checkpoints if c.title.strip()), start=1)
    ]
    checkpoints.sort(key=lambda c: c.due_at)
    dep_checks = [
        DepCheck(id=f"dc-{n}", text=d.text.strip(), met=False, source=d.source.strip())
        for n, d in enumerate((d for d in result.dep_checks if d.text.strip()), start=1)
    ]
    return ExecutionPlan(
        task_id=task.id,
        checklist=checklist,
        checkpoints=checkpoints,
        dep_checks=dep_checks,
        origin="ai",
        edited=False,
        confirmed_at=None,
    )
