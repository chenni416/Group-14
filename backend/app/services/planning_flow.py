"""Sprint 規劃流程：把資料層（app/repo）和 AI 引擎接在一起。

引擎只吃資料、回傳結果；這裡負責「讀資料 → 呼叫引擎 → 寫回資料層」。
資料層換成資料庫時，只要 store 的方法不變，這個檔案不用改。
"""

from uuid import uuid4

from app.ai.llm import LlmClient
from app.core.errors import ApiError
from app.repo import MemoryStore
from app.schemas.member import Member
from app.schemas.planning import (
    DraftDependency,
    GenerateDraftInput,
    GenerateTasksInput,
    PlanningDraft,
    ReviewerAssignment,
    StoryDraft,
    TaskDraft,
)
from app.schemas.project import ReviewPolicy
from app.schemas.sprint import AnalyzeResult, BacklogItem, Dependency, Sprint
from app.schemas.task import SuggestAssigneeResult, Task, TaskDependency
from app.services import planning, sprint_ai, task_planning
from app.services.assignment import suggest_reassignment

DRAFT_STATES = ("AI_DRAFT", "DRAFT")
"""規劃階段、尚未送出的任務狀態"""


# ---------- 草稿 ↔ 任務 ----------


def task_to_draft(t: Task) -> TaskDraft:
    return TaskDraft(
        id=t.id,
        story_id=t.epic,
        no=0,
        code=t.id,
        title=t.title,
        domain=t.domain,
        branch_prefix="feat",
        branch_slug=t.branch,
        story_points=t.story_points,
        acceptance_criteria=t.acceptance_criteria,
        assignee_id=t.assignee_id or None,
        suggested_assignee_id=t.suggested_assignee_id,
        reviewer=ReviewerAssignment(mode="leader" if t.policy.mode == "leader" else "pool", member_id=None),
        analysis=t.description,
        assign_reason=t.suggest_reason,
        depends_on=[DraftDependency(id=d.id, reason=d.reason) for d in t.depends_on],
    )


def draft_to_task(d: TaskDraft, sprint_id: int, story: StoryDraft | None, code_of: dict[str, str]) -> Task:
    from app.repo.seed import make_task

    policy = ReviewPolicy(mode="leader" if d.reviewer.mode == "leader" else "pool", targets=[], rule="any")
    return make_task(
        d.code,
        sprint_id,
        d.title,
        d.domain,
        d.story_points,
        d.suggested_assignee_id or "",
        "AI_DRAFT",
        description=d.analysis,
        story_points_reason="AI 依範疇複雜度估算",
        acceptance_criteria=d.acceptance_criteria,
        epic=f"{story.code} {story.title}" if story else "",
        story=story.user_story if story else "",
        origin="ai",
        suggested_assignee_id=d.suggested_assignee_id,
        suggest_reason=d.assign_reason,
        policy=policy,
        branch=f"{d.branch_prefix}/{d.code.replace('-', '')}-{d.branch_slug}",
        source=story.sources[0].text if story and story.sources else "",
        scope=d.title,
        depends_on=[TaskDependency(id=code_of[x.id], reason=x.reason) for x in d.depends_on if x.id in code_of],
    )


# ---------- Sprint：分析與相依 ----------


def generate_draft(store: MemoryStore, body: GenerateDraftInput, llm: LlmClient) -> PlanningDraft:
    sprint = store.planning_sprint()
    if body.goal.strip():
        sprint.goal = body.goal.strip()
    return planning.generate_draft(body, llm, sprint.id)


def analyze(store: MemoryStore, sprint_id: int, minutes: str, llm: LlmClient) -> AnalyzeResult:
    sprint = store.find_sprint(sprint_id)
    questions = sprint_ai.analyze_questions(minutes, sprint.goal, llm)
    # 重新分析時，保留已回答過的相同問題
    answered = {q.question: q.answer for q in sprint.questions or [] if q.answer}
    for q in questions:
        q.answer = answered.get(q.question, "")
    sprint.minutes = minutes
    sprint.questions = questions
    return AnalyzeResult(unanswered=sum(1 for q in questions if not q.answer))


def answer_question(store: MemoryStore, sprint_id: int, question_id: str, answer: str) -> Sprint:
    sprint = store.find_sprint(sprint_id)
    q = next((x for x in sprint.questions or [] if x.id == question_id), None)
    if q is None:
        raise ApiError("找不到這個問題", status=404, code="NOT_FOUND")
    q.answer = answer.strip()
    return sprint


def dependencies(store: MemoryStore, sprint_id: int) -> list[Dependency]:
    """本 Sprint 的相依：讀取規劃（decompose）時 AI 寫進任務的 depends_on，並依前置任務目前狀態計算風險"""
    store.find_sprint(sprint_id)
    out: list[Dependency] = []
    for t in store.sprint_tasks(sprint_id):
        for d in t.depends_on:
            target = store.tasks.get(d.id)
            if target is None:
                continue
            scope = "same" if target.sprint_id == sprint_id else "prev"
            if target.state == "DONE":
                risk = "ok"
            elif target.state == "DEFERRED" or (scope == "prev" and target.carry is False):
                risk = "high"
            else:
                risk = "mid"
            out.append(Dependency(scope=scope, task_id=t.id, depends_on_id=target.id, reason=d.reason, risk=risk))
    order = {"high": 0, "mid": 1, "ok": 2}
    return sorted(out, key=lambda d: order[d.risk])


# ---------- 規劃：拆解、延後、重新平衡 ----------


def _clarified_minutes(sprint: Sprint) -> str:
    answers = "\n".join(f"- {q.question} → {q.answer}" for q in sprint.questions or [])
    return f"{sprint.minutes.strip()}\n\n## 已釐清事項（Leader 的回答）\n{answers}" if answers else sprint.minutes


def decompose(store: MemoryStore, sprint_id: int, llm: LlmClient) -> int:
    sprint = store.find_sprint(sprint_id)
    if not sprint.minutes.strip():
        raise ApiError("請先貼上會議紀錄")
    if sprint.questions is None:
        raise ApiError("請先按「AI 分析會議紀錄」")
    if any(not q.answer for q in sprint.questions):
        raise ApiError("還有待釐清問題未回答，無法分配任務")

    members = store.members_for(sprint)
    # 重新拆解：保留 Leader 調整過或手動建立的任務，其餘 AI 草稿重做
    kept = {
        t.id for t in store.sprint_tasks(sprint_id) if t.edited or t.origin == "human" or t.state not in DRAFT_STATES
    }

    draft = planning.generate_draft(
        GenerateDraftInput(goal=sprint.goal, minutes=_clarified_minutes(sprint)), llm, sprint_id
    )
    drafts = task_planning.generate_tasks(
        GenerateTasksInput(sprint_id=sprint_id, stories=draft.stories, existing_task_count=len(kept)), members, llm
    )
    new = [d for d in drafts if d.code not in kept]
    code_of = {d.id: d.code for d in drafts}
    stories = {s.id: s for s in draft.stories}
    created = [draft_to_task(d, sprint_id, stories.get(d.story_id), code_of) for d in new]

    # 跨 Sprint 相依：新任務依賴上一輪的哪些成果（上一輪沒有任務時略過，不浪費一次呼叫）
    prev_id = store.prev_sprint_id(sprint_id)
    previous = store.sprint_tasks(prev_id) if prev_id is not None else []
    if created and previous:
        for dep in sprint_ai.analyze_dependencies(created, previous, llm):
            if dep.scope == "prev":
                next(t for t in created if t.id == dep.task_id).depends_on.append(
                    TaskDependency(id=dep.depends_on_id, reason=dep.reason)
                )

    for t in store.sprint_tasks(sprint_id):
        if t.id not in kept:
            del store.tasks[t.id]
    for t in created:
        store.tasks[t.id] = t
    sprint.step = max(sprint.step, 4)
    return len(created)


def _draftable(store: MemoryStore, sprint_id: int) -> list[Task]:
    return [t for t in store.sprint_tasks(sprint_id) if t.state in DRAFT_STATES]


def defer_suggested(store: MemoryStore, sprint_id: int, llm: LlmClient) -> int:
    sprint = store.find_sprint(sprint_id)
    tasks = _draftable(store, sprint_id)
    ids = task_planning.defer_suggested([task_to_draft(t) for t in tasks], sprint.goal, store.members_for(sprint), llm)
    for task_id in ids:
        task = store.tasks[task_id]
        task.prev_state, task.state = task.state, "DEFERRED"
        store.backlog.append(
            BacklogItem(
                id=f"b-{uuid4().hex[:8]}",
                text=f"{task.id} {task.title}",
                from_sprint=sprint.name,
                kind="deferred",
                task_id=task.id,
                used_in_sprint_id=None,
                decision=None,
            )
        )
    return len(ids)


def rebalance(store: MemoryStore, sprint_id: int, llm: LlmClient) -> int:
    sprint = store.find_sprint(sprint_id)
    tasks = _draftable(store, sprint_id)
    drafts = [task_to_draft(t) for t in tasks]
    locked = frozenset(t.id for t in tasks if t.edited or t.origin == "human")
    updated = task_planning.rebalance(drafts, store.members_for(sprint), llm, locked)
    for t, d in zip(tasks, drafts, strict=True):
        if t.id in locked:
            continue
        t.suggested_assignee_id, t.suggest_reason = d.suggested_assignee_id, d.assign_reason
        t.assignee_id = d.suggested_assignee_id or t.assignee_id
    return updated


# ---------- 協商退回：重新建議負責人 ----------


def suggest_assignee(store: MemoryStore, task_id: str, llm: LlmClient) -> SuggestAssigneeResult:
    task = store.find_task(task_id)
    sprint = store.find_sprint(task.sprint_id)
    nego = task.negotiation
    excluded = {nego.by_id} if nego else set()
    members: list[Member] = store.members_for(sprint)
    loads = store.planned_load(task.sprint_id, exclude={task.id})
    hint = f"{nego.reason}（協商項目：{nego.target or '未指定'}；成員建議：{nego.suggest_id or '無'}）" if nego else ""
    found = suggest_reassignment(task, members, excluded, loads, hint, llm)
    if found is None:
        raise ApiError("沒有可指派的成員")
    member_id, reason, fits = found
    suffix = (
        "" if fits else f"。目前沒有成員有 {task.story_points} SP 的剩餘點數，需調低點數、延後此任務，或調整其他任務"
    )
    excluded_note = f"（已排除提出協商的 {store.find_member(nego.by_id).name}）" if nego else ""
    task.assignee_id = member_id
    task.suggested_assignee_id = member_id
    task.edited = True
    task.suggest_reason = f"{reason}{excluded_note}{suffix}"
    return SuggestAssigneeResult(task=task, fits=fits)
