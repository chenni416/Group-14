"""規劃階段的任務審核與核准派工：新增、修改、延後、恢復、帶入決定、核准前檢查、送出規劃。

規則移植自前端 services/mock/tasks.ts、mocks/handlers/planning.ts 與 lib/planning.ts；資料暫存在記憶體（MemoryStore）。
AI 產生草稿的部分在 planning_flow.py，這裡處理 Leader 之後的人工調整與送出。
"""

from app.core.errors import ApiError
from app.repo.memory import MemoryStore
from app.repo.seed import make_task
from app.schemas.member import Member
from app.schemas.planning import PlanningDraft, StoryDraft, TaskDraft
from app.schemas.project import ReviewPolicy
from app.schemas.sprint import BacklogItem, Sprint
from app.schemas.task import CreateTaskInput, SetCarryInput, Task, TaskDependency, UpdateTaskInput

DRAFT_STATES = ("AI_DRAFT", "DRAFT")
EDITABLE_PLAN_STATES = ("AI_DRAFT", "DRAFT", "RETURNED")
"""Leader 可以修改的狀態（草稿與協商退回）"""
CARRY_POINTS_MAX = 40

GENERIC_AC = {
    "FE": ["畫面與 Figma 一致，375px 手機寬度正常", "具備載入、錯誤與空狀態"],
    "BE": ["API 有文件（輸入／輸出／錯誤碼）", "關鍵路徑有單元測試且通過"],
    "AI": ["有固定測試集與評估指標", "結果可重現（記錄參數與版本）"],
    "QA": ["涵蓋主要流程與至少一個例外流程", "在 CI 上全數通過"],
    "DS": ["提供 Figma 元件並標註互動狀態", "經一位前端成員確認可實作"],
}
DOMAIN_TAGS = {
    "FE": ["React", "TypeScript"],
    "BE": ["FastAPI", "PostgreSQL"],
    "AI": ["LLM", "RAG"],
    "QA": ["Playwright"],
    "DS": ["Figma", "Design System"],
}


def normalize_policy(policy: ReviewPolicy) -> ReviewPolicy:
    """只有「指定成員」模式才保留 targets"""
    return ReviewPolicy(
        mode=policy.mode, targets=list(policy.targets) if policy.mode == "target" else [], rule=policy.rule
    )


# ---------- 容量與核准前檢查（同前端 lib/planning.ts） ----------


def cap_of(sprint: Sprint, member: Member) -> int:
    """本次 Capacity：Sprint 直接預估的點數，沒有設定時用成員預設值"""
    return sprint.capacity.get(member.id, member.capacity)


def task_problems(t: Task) -> list[str]:
    """核准前必須補齊的欄位"""
    out: list[str] = []
    if not t.assignee_id:
        out.append("沒有負責人")
    if not t.acceptance_criteria:
        out.append("沒有驗收條件")
    if t.policy.mode == "target" and not t.policy.targets:
        out.append("指定審查但未選人員")
    return out


def plan_load(store: MemoryStore, sprint_id: int) -> dict[str, int]:
    """每人負載 = 本次任務點數 + 上輪帶入任務的本輪預估點數（只計目前的成員）"""
    load = {m.id: 0 for m in store.members}
    for t in store.carry_tasks(sprint_id):
        owner = t.carry_assignee_id or t.assignee_id
        if t.carry is True and owner in load:
            load[owner] += t.carry_points if t.carry_points is not None else t.story_points
    for t in store.plan_tasks(sprint_id):
        if t.assignee_id in load:
            load[t.assignee_id] += t.story_points
    return load


def preflight(store: MemoryStore, sprint: Sprint) -> dict:
    load = plan_load(store, sprint.id)
    drafts = [t for t in store.plan_tasks(sprint.id) if t.state in DRAFT_STATES]
    over = [(m, load[m.id], cap_of(sprint, m)) for m in store.members if load[m.id] > cap_of(sprint, m)]
    missing = [(t, task_problems(t)) for t in drafts if task_problems(t)]
    unanswered = [q for q in sprint.questions or [] if not q.answer]
    return {
        "drafts": drafts,
        "over": over,
        "missing": missing,
        "unanswered": unanswered,
        "blocked": bool(over or missing or unanswered),
    }


# ---------- 查詢、新增、修改、刪除 ----------


def list_tasks(store: MemoryStore) -> list[Task]:
    return list(store.tasks.values())


def _loose_task_id(store: MemoryStore, sprint_id: int) -> str:
    """不屬於任何 Story 的任務編號（手動新增）：Story 序號用 0，例如 S-301、S-302"""
    n = 1
    while f"S-{sprint_id}0{n}" in store.tasks:
        n += 1
    return f"S-{sprint_id}0{n}"


def create_task(store: MemoryStore, body: CreateTaskInput) -> Task:
    sprint = store.planning_sprint()
    if body.assignee_id:
        store.find_member(body.assignee_id)
    if not body.title.strip():
        raise ApiError("請輸入標題")
    source = body.source.strip()
    task = make_task(
        _loose_task_id(store, sprint.id),
        sprint.id,
        body.title.strip(),
        body.domain,
        body.story_points,
        body.assignee_id,
        "DRAFT",
        story_points_reason=body.story_points_reason.strip(),
        origin="human",
        epic="手動任務",
        story="Leader 新增",
        source=source,
        description=f"會議紀錄：「{source}」" if source else f"{body.title.strip()}。詳細規格見 PRD 對應章節。",
        policy=normalize_policy(body.policy),
        tags=list(DOMAIN_TAGS[body.domain]),
        acceptance_criteria=body.acceptance_criteria or ["成果與會議決議一致", *GENERIC_AC[body.domain]],
        scope=f"完成「{body.title.strip()}」，並通過上列驗收條件。",
        out_of_scope="不包含規格以外的新需求；有新想法請走提案。",
        responsibility="負責實作、更新執行計畫進度，遇到阻礙時回報問題。",
        deliverables=[f"{body.title.strip()} 的實作（PR）", "對應的測試或驗證紀錄"],
    )
    task.branch = f"{'test' if body.domain == 'QA' else 'feat'}/S{task.id.removeprefix('S-')}-task"
    store.tasks[task.id] = task
    return task


def update_task(store: MemoryStore, task_id: str, patch: UpdateTaskInput) -> Task:
    if patch.assignee_id:
        store.find_member(patch.assignee_id)
    task = store.find_task(task_id)
    if task.state not in EDITABLE_PLAN_STATES:
        raise ApiError("只有草稿或協商退回的任務可以編輯")
    for key in patch.model_fields_set:
        value = getattr(patch, key)
        if key == "policy" and value is not None:
            value = normalize_policy(value)
        if value is not None:
            setattr(task, key, value)
    task.edited = True
    return task


def remove_task(store: MemoryStore, task_id: str) -> None:
    store.tasks.pop(task_id, None)


# ---------- 延後與恢復 ----------


def defer_task(store: MemoryStore, task: Task, from_sprint: str, text: str | None = None) -> None:
    task.prev_state = task.state
    task.state = "DEFERRED"
    store.resolve_notifications(task.id, ["returned", "invite"])
    store.backlog.append(
        BacklogItem(
            id=f"b{store.uid()}",
            text=text or task.title,
            from_sprint=from_sprint,
            kind="deferred",
            task_id=task.id,
            used_in_sprint_id=None,
            decision=None,
        )
    )


def defer(store: MemoryStore, me: Member, task_id: str) -> Task:
    sprint = store.planning_sprint()
    task = store.find_task(task_id)
    if task.state not in EDITABLE_PLAN_STATES and task.state != "PENDING_MEMBER":
        raise ApiError("只有草稿、協商退回或尚未被接受的任務可以延後")
    defer_task(store, task, sprint.name)
    if task.assignee_id and task.assignee_id != me.id:  # 通知受影響的負責人，請他同意或提出異議
        store.notify(
            task.assignee_id, "plan", task.id, me.id, f"{task.id} {task.title} 將延後到下一個 Sprint，請同意或提出異議"
        )
    return task


def restore(store: MemoryStore, task_id: str) -> Task:
    task = store.find_task(task_id)
    task.state = task.prev_state or ("DRAFT" if task.origin == "human" else "AI_DRAFT")
    task.prev_state = None
    store.backlog = [b for b in store.backlog if b.task_id != task_id or b.used_in_sprint_id is not None]
    return task


# ---------- 上輪未完成任務：帶入或延後 ----------


def _closing_sprint_id(store: MemoryStore) -> int | None:
    """正在統整的上一輪 Sprint：有規劃中的 Sprint 時為它的前一個，否則為進行中的 Sprint"""
    if store.planning_sprint_id is not None:
        return store.prev_sprint_id(store.planning_sprint_id)
    return store.active_sprint_id


def set_carry(store: MemoryStore, task_id: str, body: SetCarryInput) -> Task:
    task = store.find_task(task_id)
    if task.carry_status is not None:
        raise ApiError("派工通知已送出，需由成員協商退回後才能修改帶入或延後的決定", status=409, code="CONFLICT")
    unfinished = task.state in ("TODO", "IN_PROGRESS", "IN_REVIEW")
    if task.sprint_id != _closing_sprint_id(store) or not unfinished:
        raise ApiError("只有上一輪未完成的任務可以帶入或延後")
    apply_carry(store, task, body)
    return task


def apply_carry(store: MemoryStore, task: Task, body: SetCarryInput) -> None:
    """把帶入或延後的決定寫進任務（不檢查任務狀態；呼叫端負責）"""
    if body.assignee_id:
        store.find_member(body.assignee_id)
    if body.points is not None and not 1 <= body.points <= CARRY_POINTS_MAX:
        raise ApiError(f"本輪預估點數需為 1 到 {CARRY_POINTS_MAX} 的整數")
    task.carry = body.carry
    if body.carry is not True:
        task.carry_assignee_id = None
        task.carry_points = None
        return
    if body.assignee_id is not None:
        task.carry_assignee_id = body.assignee_id if body.assignee_id and body.assignee_id != task.assignee_id else None
    if body.points is not None:
        task.carry_points = None if body.points == task.story_points else body.points


# ---------- 核准與送出 ----------


def approve_drafts(store: MemoryStore, me: Member) -> int:
    sprint = store.planning_sprint()
    check = preflight(store, sprint)
    if check["blocked"]:
        reasons = [f"{m.name} 超過點數上限（{load}/{cap}）" for m, load, cap in check["over"]]
        reasons += [f"{t.id} {'、'.join(problems)}" for t, problems in check["missing"]]
        if check["unanswered"]:
            reasons.append(f"還有 {len(check['unanswered'])} 題待釐清問題未回答")
        raise ApiError(f"核准前檢查未通過：{'；'.join(reasons)}", status=422, code="PREFLIGHT_FAILED")
    for t in check["drafts"]:
        t.state = "PENDING_MEMBER"
        store.notify(t.assignee_id, "invite", t.id, me.id, f"預估 {t.story_points} 點，請確認是否接受")
    sprint.step = 5
    return len(check["drafts"])


def _record_deferred(store: MemoryStore, sprint_id: int, stories: list[StoryDraft], tasks: list[TaskDraft]) -> None:
    """本輪延後的 Story／Task 寫進延續事項：延後的 Story 一筆（含其 Task），個別延後的 Task 各一筆"""
    from_sprint = store.sprints[sprint_id].name if sprint_id in store.sprints else f"Sprint {sprint_id}"
    story_ids = {s.id for s in stories}

    def add(text: str) -> None:
        store.backlog.append(
            BacklogItem(
                id=f"b{store.uid()}",
                text=text,
                from_sprint=from_sprint,
                kind="deferred",
                task_id=None,
                used_in_sprint_id=None,
                decision=None,
            )
        )

    for s in stories:
        count = sum(1 for t in tasks if t.story_id == s.id)
        add(f"{s.code} {s.title}" + (f"（{count} 張 Task）" if count else ""))
    for t in tasks:
        if t.story_id not in story_ids:
            add(f"{t.code} {t.title}")


def _blocking_issue(stories: list[StoryDraft], tasks: list[TaskDraft]) -> str | None:
    """需等待的 Story／Task 已延後 → 不能送出"""
    story_map = {s.id: s for s in stories}
    task_map = {t.id: t for t in tasks}
    for s in stories:
        if s.deferred:
            continue
        for d in s.depends_on:
            dep = story_map.get(d.id)
            if dep and dep.deferred:
                return f"{s.code} 需等待的 {dep.code} 已延後"
    for t in tasks:
        if t.deferred:
            continue
        for d in t.depends_on:
            dep = task_map.get(d.id)
            if dep and dep.deferred:
                return f"{t.code} 需等待的 {dep.code} 已延後"
    return None


def submit_plan(store: MemoryStore, me: Member, draft: PlanningDraft) -> int:
    """核准規劃：把草稿建立成正式任務並通知負責人。回傳任務數"""
    from app.services.planning_flow import draft_to_task

    if store.sprint_tasks(draft.sprint_id):
        raise ApiError("本 Sprint 已送出規劃，不能重複核准", status=409, code="CONFLICT")
    stories = [s for s in draft.stories if not s.deferred]
    tasks = [t for t in draft.tasks if not t.deferred]
    unassigned = [t for t in tasks if not t.assignee_id]
    if unassigned:
        raise ApiError(f"還有 {len(unassigned)} 張 Task 尚未指派負責人")
    carried = store.carry_tasks(draft.sprint_id)
    undecided = [t for t in carried if t.carry is None]
    if undecided:
        raise ApiError(f"上輪還有 {len(undecided)} 項未完成任務尚未決定帶入或延後")
    blocking = _blocking_issue(draft.stories, draft.tasks)
    if blocking:
        raise ApiError(f"{blocking}，請先一起延後或移除相依")
    taken = next((t for t in tasks if t.code in store.tasks), None)
    if taken:
        raise ApiError(f"任務編號 {taken.code} 已被使用", status=409, code="CONFLICT")
    for t in tasks:
        store.find_member(t.assignee_id or "")

    code_of = {t.id: t.code for t in tasks} | {c.id: c.id for c in carried}
    story_map = {s.id: s for s in stories}
    for d in tasks:
        task = draft_to_task(d, draft.sprint_id, story_map.get(d.story_id), code_of)
        task.state = "PENDING_MEMBER"
        task.assignee_id = d.assignee_id or ""
        task.edited = d.assignee_id != d.suggested_assignee_id
        task.depends_on = [TaskDependency(id=code_of[x.id], reason=x.reason) for x in d.depends_on if x.id in code_of]
        task.policy = (
            ReviewPolicy(mode="target", targets=[d.reviewer.member_id] if d.reviewer.member_id else [], rule="any")
            if d.reviewer.mode == "member"
            else ReviewPolicy(mode=d.reviewer.mode, targets=[], rule="any")
        )
        task.tags = list(DOMAIN_TAGS[d.domain])
        store.tasks[task.id] = task
        store.notify(task.assignee_id, "invite", task.id, me.id, f"預估 {d.story_points} 點，請確認是否接受")

    _record_deferred(
        store, draft.sprint_id, [s for s in draft.stories if s.deferred], [t for t in draft.tasks if t.deferred]
    )
    # 上輪未完成任務的帶入／延後決定一起發送給成員確認：帶入給（改派後的）負責人、延後給目前負責人
    for c in carried:
        confirmer = c.assignee_id if c.carry is False else (c.carry_assignee_id or c.assignee_id)
        c.carry_status = "pending"
        text = (
            f"上輪未完成，Leader 評估本輪需要 {c.carry_points or c.story_points} 點完成，將帶入下個 Sprint，請確認"
            if c.carry
            else "上輪未完成，Leader 決定延後到之後的 Sprint，請確認"
        )
        store.notify(confirmer, "invite", c.id, me.id, text)
    if draft.sprint_id in store.sprints:
        store.sprints[draft.sprint_id].step = 5
    return len(tasks)
