"""請求範圍的資料庫 store：把一個專案的資料載入成 `MemoryStore`，請求結束時把有變動的部分寫回資料表。

為什麼這樣做：任務、規劃、派工、審查的規則（task_flow、planning_flow、task_edit_flow…）已經寫好並有測試，
它們操作的是 `MemoryStore`。這裡不重寫規則，只在「請求開始」與「請求結束」兩個點接上資料庫：

    請求開始  load()  → 查出這個專案的成員、Sprint、任務、延續事項、執行計畫、通知，組成 MemoryStore
    處理請求  既有的流程照舊修改 MemoryStore
    請求結束  save()  → 和載入時的快照比較，只把新增、修改、刪除的資料列寫回

`app/api/deps.py` 的 `ProjectStore` 負責呼叫它們；沒有發生錯誤才會寫回（錯誤時整個請求 rollback）。

注意事項：
- 每個專案各自一份，不同專案的資料互不影響（記憶體版是全域一份）
- 會修改資料的請求（非 GET）載入時鎖住專案列（SELECT … FOR UPDATE），同一專案的修改依序進行，避免互相覆蓋；
  代價是 AI 呼叫期間同專案的其他修改要等待
- API 的 id 與資料庫 id 的對應：Task.id = tasks.code、Sprint.id = sprints.number、成員 id = members.id（uuid 字串）
- 還沒有對應資料表欄位的資料不會保存：Task.pr 只有讀取（取自 github_pull_requests 最新一筆）
"""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.ai.context import DocSnippet
from app.core.errors import ApiError
from app.models import BacklogItem as BacklogRow
from app.models import Document as DocumentRow
from app.models import ExecutionPlan as PlanRow
from app.models import GithubPullRequest as PullRequestRow
from app.models import Notification as NotificationRow
from app.models import Project as ProjectRow
from app.models import PromptThread as ThreadRow
from app.models import Sprint as SprintRow
from app.models import Task as TaskRow
from app.models import TaskChatMessage as ChatRow
from app.models import TaskDependency as DependencyRow
from app.repo.memory import MemoryStore, PromptThread
from app.schemas.acceptance import Delivery
from app.schemas.collab import ChatMessage, ExecutionPlan, Notification
from app.schemas.project import ReviewPolicy
from app.schemas.sprint import BacklogItem, ClarifyQuestion, Sprint, SprintSummary
from app.schemas.task import (
    Negotiation,
    PlanConfirm,
    PullRequest,
    ReturnSnapshot,
    Task,
    TaskDependency,
)


def _uuid(value: str | None) -> uuid.UUID | None:
    """API 的 id 是字串；不是 uuid 的（空字串、示範資料的 m1…）一律視為沒有"""
    try:
        return uuid.UUID(value) if value else None
    except ValueError:
        return None


def _iso(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


def _datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _json(model: BaseModel | None) -> dict[str, Any] | None:
    return model.model_dump(mode="json", by_alias=True) if model is not None else None


@dataclass
class Snapshot:
    """載入當下每筆資料的內容，結束時用來判斷哪些有變動"""

    project_id: uuid.UUID
    sprints: dict[int, dict[str, Any]] = field(default_factory=dict)
    tasks: dict[str, dict[str, Any]] = field(default_factory=dict)
    backlog: dict[str, dict[str, Any]] = field(default_factory=dict)
    plans: dict[str, dict[str, Any]] = field(default_factory=dict)
    threads: dict[str, tuple[list[list[str]], int]] = field(default_factory=dict)
    chat: dict[str, set[str]] = field(default_factory=dict)
    notifications: dict[str, dict[str, Any]] = field(default_factory=dict)


def _dump(model: BaseModel) -> dict[str, Any]:
    return model.model_dump(mode="json")


# ---------- 資料列 → API 物件 ----------


def _pull_request(row: PullRequestRow | None) -> PullRequest | None:
    if row is None:
        return None
    tests = {"success": "passed", "passed": "passed", "failure": "failed", "failed": "failed"}.get(
        row.checks_state, "none"
    )
    return PullRequest(
        number=row.number,
        status="merged" if row.state == "merged" else "open",
        url=row.url,
        tests=tests,  # type: ignore[arg-type]
        changed_files=None,
        summary=None,
    )


def _task_schema(
    row: TaskRow,
    sprint_number: dict[uuid.UUID, int],
    code_of: dict[uuid.UUID, str],
    deps: dict[uuid.UUID, list[TaskDependency]],
    pr: PullRequestRow | None,
) -> Task:
    def member(value: uuid.UUID | None) -> str | None:
        return str(value) if value else None

    return Task(
        id=row.code,
        sprint_id=sprint_number[row.sprint_id],
        title=row.title,
        description=row.description,
        domain=row.domain,  # type: ignore[arg-type]
        tags=list(row.tags),
        story_points=row.story_points,
        story_points_reason=row.story_points_reason,
        acceptance_criteria=list(row.acceptance_criteria),
        epic=row.epic,
        story=row.story,
        origin=row.origin,  # type: ignore[arg-type]
        edited=row.edited,
        state=row.state,  # type: ignore[arg-type]
        assignee_id=member(row.assignee_member_id) or "",
        suggested_assignee_id=member(row.suggested_assignee_member_id),
        suggest_reason=row.suggest_reason,
        policy=ReviewPolicy.model_validate(row.policy),
        policy_reason=row.policy_reason,
        reviewer_id=member(row.reviewer_member_id),
        approvals=[str(a) for a in row.approvals],
        claimed_at=_iso(row.claimed_at),
        review_started_at=_iso(row.review_started_at),
        pr=_pull_request(pr),
        branch=row.branch,
        negotiation=Negotiation.model_validate(row.negotiation) if row.negotiation else None,
        source=row.source,
        carry_tag=row.carry_tag,  # type: ignore[arg-type]
        multi_sprint=row.multi_sprint,
        clarified=row.clarified,
        carry=row.carry,
        carry_assignee_id=member(row.carry_assignee_member_id),
        carry_points=row.carry_points,
        carry_status=row.carry_status,  # type: ignore[arg-type]
        depends_on=deps.get(row.id, []),
        return_snapshot=ReturnSnapshot.model_validate(row.return_snapshot) if row.return_snapshot else None,
        prev_state=row.prev_state,  # type: ignore[arg-type]
        scope=row.scope,
        out_of_scope=row.out_of_scope,
        responsibility=row.responsibility,
        deliverables=list(row.deliverables),
        plan_confirms=[PlanConfirm.model_validate(c) for c in row.plan_confirms or []],
        delivery=Delivery.model_validate(row.delivery) if row.delivery else None,
    )


def _apply_task(row: TaskRow, t: Task) -> None:
    """把 API 物件的內容寫進資料列（code、project_id、sprint_id 由呼叫端處理）"""
    row.title = t.title
    row.description = t.description
    row.domain = t.domain
    row.tags = list(t.tags)
    row.story_points = t.story_points
    row.story_points_reason = t.story_points_reason
    row.acceptance_criteria = list(t.acceptance_criteria)
    row.epic = t.epic
    row.story = t.story
    row.origin = t.origin
    row.edited = t.edited
    row.state = t.state
    row.assignee_member_id = _uuid(t.assignee_id)
    row.suggested_assignee_member_id = _uuid(t.suggested_assignee_id)
    row.suggest_reason = t.suggest_reason
    row.policy = _json(t.policy)
    row.policy_reason = t.policy_reason
    row.reviewer_member_id = _uuid(t.reviewer_id)
    row.approvals = [u for u in (_uuid(a) for a in t.approvals) if u]
    row.claimed_at = _datetime(t.claimed_at)
    row.review_started_at = _datetime(t.review_started_at)
    row.branch = t.branch
    row.negotiation = _json(t.negotiation)
    row.source = t.source
    row.carry_tag = t.carry_tag
    row.multi_sprint = t.multi_sprint
    row.clarified = t.clarified
    row.carry = t.carry
    row.carry_assignee_member_id = _uuid(t.carry_assignee_id)
    row.carry_points = t.carry_points
    row.carry_status = t.carry_status
    row.return_snapshot = _json(t.return_snapshot)
    row.prev_state = t.prev_state
    row.scope = t.scope
    row.out_of_scope = t.out_of_scope
    row.responsibility = t.responsibility
    row.deliverables = list(t.deliverables)
    row.plan_confirms = [_json(c) for c in t.plan_confirms]
    row.delivery = _json(t.delivery)
    row.updated_at = datetime.now(UTC)


def _sprint_schema(row: SprintRow) -> Sprint:
    """不含會議文件（Sprint.docs）：規劃流程不讀取它，Sprint API 由 services/sprints.py 處理"""
    from app.services.sprint_flow import month_day

    return Sprint(
        id=row.number,
        name=row.name,
        start=month_day(row.start_date.isoformat()),
        end=month_day(row.end_date.isoformat()),
        start_date=row.start_date.isoformat(),
        end_date=row.end_date.isoformat(),
        goal=row.goal,
        status=row.status,  # type: ignore[arg-type]
        capacity={k: int(v) for k, v in (row.capacity or {}).items()},
        minutes=row.minutes,
        docs=[],
        questions=[ClarifyQuestion(**q) for q in row.clarify_questions] if row.clarify_questions is not None else None,
        step=row.planning_step,  # type: ignore[arg-type]
        summary=SprintSummary(**row.summary) if row.summary else None,
    )


# ---------- 載入 ----------


def load(db: Session, project_id: uuid.UUID, *, lock: bool = False) -> tuple[MemoryStore, Snapshot]:
    from app.services import projects

    query = select(ProjectRow).where(ProjectRow.id == project_id)
    project_row = db.scalars(query.with_for_update() if lock else query).one_or_none()
    if project_row is None:
        raise ApiError("找不到專案", status=404, code="NOT_FOUND")

    store = MemoryStore()
    snap = Snapshot(project_id=project_id)
    store.project_goal = project_row.goal
    store.members = projects.list_project_members(db, project_id)
    store.project = projects.to_schema(project_row)
    store.org = projects.organization_of(db, project_row)

    sprint_rows = db.scalars(select(SprintRow).where(SprintRow.project_id == project_id)).all()
    number_of = {r.id: r.number for r in sprint_rows}
    for r in sprint_rows:
        sprint = _sprint_schema(r)
        store.sprints[r.number] = sprint
        snap.sprints[r.number] = _dump(sprint)
        if r.status == "active":
            store.active_sprint_id = r.number
        elif r.status == "planning":
            store.planning_sprint_id = r.number

    task_rows = db.scalars(select(TaskRow).where(TaskRow.project_id == project_id).order_by(TaskRow.code)).all()
    code_of = {r.id: r.code for r in task_rows}
    deps: dict[uuid.UUID, list[TaskDependency]] = {}
    for d in db.scalars(select(DependencyRow).where(DependencyRow.task_id.in_(code_of))):
        if d.depends_on_task_id in code_of:
            deps.setdefault(d.task_id, []).append(TaskDependency(id=code_of[d.depends_on_task_id], reason=d.reason))
    latest_pr: dict[uuid.UUID, PullRequestRow] = {}
    for pr in db.scalars(
        select(PullRequestRow)
        .where(PullRequestRow.project_id == project_id, PullRequestRow.task_id.is_not(None))
        .order_by(PullRequestRow.opened_at)
    ):
        latest_pr[pr.task_id] = pr  # type: ignore[index]
    for r in task_rows:
        task = _task_schema(r, number_of, code_of, deps, latest_pr.get(r.id))
        store.tasks[r.code] = task
        snap.tasks[r.code] = _dump(task)

    backlog_rows = db.scalars(
        select(BacklogRow)
        .where(BacklogRow.project_id == project_id)
        .order_by(BacklogRow.created_at, BacklogRow.text, BacklogRow.id)
    ).all()
    name_of = {r.id: r.name for r in sprint_rows}
    for b in backlog_rows:
        item = BacklogItem(
            id=str(b.id),
            text=b.text,
            from_sprint=name_of.get(b.from_sprint_id, "") if b.from_sprint_id else "",
            kind=b.kind,  # type: ignore[arg-type]
            task_id=code_of.get(b.task_id) if b.task_id else None,
            used_in_sprint_id=number_of.get(b.used_in_sprint_id) if b.used_in_sprint_id else None,
            decision=b.decision,  # type: ignore[arg-type]
        )
        store.backlog.append(item)
        snap.backlog[item.id] = _dump(item)

    for p in db.scalars(select(PlanRow).where(PlanRow.task_id.in_(code_of))):
        plan = ExecutionPlan(
            task_id=code_of[p.task_id],
            checklist=p.checklist,  # type: ignore[arg-type]
            checkpoints=p.checkpoints,  # type: ignore[arg-type]
            dep_checks=p.dep_checks,  # type: ignore[arg-type]
            origin=p.origin,  # type: ignore[arg-type]
            edited=p.edited,
            confirmed_at=_iso(p.confirmed_at),
        )
        store.plans[plan.task_id] = plan
        snap.plans[plan.task_id] = _dump(plan)

    chat_rows = db.scalars(select(ChatRow).where(ChatRow.task_id.in_(code_of)).order_by(ChatRow.created_at)).all()
    for t in db.scalars(select(ThreadRow).where(ThreadRow.task_id.in_(code_of))):
        code = code_of[t.task_id]
        store.threads[code] = PromptThread(clarifications=[list(c) for c in t.clarifications], cursor=t.cursor)
        snap.threads[code] = ([list(c) for c in t.clarifications], t.cursor)
    for m in chat_rows:
        code = code_of[m.task_id]
        thread = store.threads.setdefault(code, PromptThread())
        thread.chat.append(
            ChatMessage(
                id=str(m.id),
                role=m.role,  # type: ignore[arg-type]
                text=m.text,
                sources=list(m.sources) if m.sources is not None else None,
                prompt_addition=m.prompt_addition,
                prompt_version=m.prompt_version,
            )
        )
        snap.chat.setdefault(code, set()).add(str(m.id))

    for n in db.scalars(
        select(NotificationRow).where(NotificationRow.task_id.in_(code_of)).order_by(NotificationRow.created_at.desc())
    ):
        note = Notification(
            id=str(n.id),
            to_id=str(n.recipient_member_id),
            from_id=str(n.sender_member_id) if n.sender_member_id else "",
            type=n.type,  # type: ignore[arg-type]
            task_id=code_of[n.task_id] if n.task_id else "",
            ref_id=str(n.ref_id) if n.ref_id else None,
            text=n.text,
            created_at=_iso(n.created_at) or "",
            status=n.status,  # type: ignore[arg-type]
        )
        store.notifications.append(note)
        snap.notifications[note.id] = _dump(note)

    store.docs = [
        DocSnippet(name=name, text=text)
        for name, text in db.execute(
            select(DocumentRow.name, DocumentRow.extracted_text)
            .where(DocumentRow.project_id == project_id, DocumentRow.extracted_text.is_not(None))
            .order_by(DocumentRow.created_at)
        )
        if text
    ]
    return store, snap


# ---------- 寫回 ----------


def save(db: Session, store: MemoryStore, snap: Snapshot) -> None:
    """把和載入時不同的資料寫回資料庫（呼叫者負責 commit）"""
    project_id = snap.project_id
    sprint_rows = {r.number: r for r in db.scalars(select(SprintRow).where(SprintRow.project_id == project_id))}
    sprint_uuid = {number: r.id for number, r in sprint_rows.items()}

    _save_sprints(db, store, snap, sprint_rows)
    task_uuid = _save_tasks(db, store, snap, sprint_uuid)
    _save_backlog(db, store, snap, sprint_rows, task_uuid)
    _save_plans(db, store, snap, task_uuid)
    _save_threads(db, store, snap, task_uuid)
    _save_notifications(db, store, snap, task_uuid)
    db.flush()


def _save_sprints(db: Session, store: MemoryStore, snap: Snapshot, rows: dict[int, SprintRow]) -> None:
    changed = [
        (rows[number], sprint)
        for number, sprint in store.sprints.items()
        if number in rows and _dump(sprint) != snap.sprints.get(number)
    ]
    # 每個專案最多一個進行中的 Sprint（部分唯一索引，不能延後檢查）：Sprint 2 啟動時要先把 Sprint 1 改成結束，
    # 才能把 Sprint 2 改成進行中；兩個放在同一批 UPDATE 時順序不固定，所以分兩批寫入
    for phase_active in (False, True):
        for row, sprint in changed:
            if (sprint.status == "active") == phase_active:
                _apply_sprint(row, sprint)
        db.flush()


def _apply_sprint(row: SprintRow, sprint: Sprint) -> None:
    row.name = sprint.name
    row.start_date = datetime.fromisoformat(sprint.start_date).date()
    row.end_date = datetime.fromisoformat(sprint.end_date).date()
    row.goal = sprint.goal
    row.status = sprint.status
    row.capacity = dict(sprint.capacity)
    row.minutes = sprint.minutes
    row.clarify_questions = [q.model_dump() for q in sprint.questions] if sprint.questions is not None else None
    row.planning_step = sprint.step
    row.summary = sprint.summary.model_dump() if sprint.summary else None
    row.updated_at = datetime.now(UTC)


def _save_tasks(
    db: Session, store: MemoryStore, snap: Snapshot, sprint_uuid: dict[int, uuid.UUID]
) -> dict[str, uuid.UUID]:
    """回傳 任務編號 → 資料列 id（含新增的），給延續事項、執行計畫、通知對應用"""
    project_id = snap.project_id
    rows = {r.code: r for r in db.scalars(select(TaskRow).where(TaskRow.project_id == project_id))}
    task_uuid = {code: r.id for code, r in rows.items()}

    removed = [code for code in snap.tasks if code not in store.tasks]
    if removed:
        db.execute(delete(TaskRow).where(TaskRow.project_id == project_id, TaskRow.code.in_(removed)))
        for code in removed:
            task_uuid.pop(code, None)

    changed: list[tuple[str, Task]] = []
    for code, task in store.tasks.items():
        if _dump(task) == snap.tasks.get(code):
            continue
        sprint_id = sprint_uuid.get(task.sprint_id)
        if sprint_id is None:
            raise ApiError(f"任務 {code} 指向不存在的 Sprint {task.sprint_id}", status=500, code="INTERNAL_ERROR")
        row = rows.get(code)
        if row is None:
            row = TaskRow(id=uuid.uuid4(), project_id=project_id, code=code, sprint_id=sprint_id)
            db.add(row)
            task_uuid[code] = row.id
        row.sprint_id = sprint_id
        _apply_task(row, task)
        changed.append((code, task))
    if changed:
        db.flush()  # 先有資料列，相依才能指過去（也包含這次新增的任務）
        ids = [task_uuid[code] for code, _ in changed]
        db.execute(delete(DependencyRow).where(DependencyRow.task_id.in_(ids)))
        for code, task in changed:
            seen: set[str] = set()
            for dep in task.depends_on:
                target = task_uuid.get(dep.id)
                if target is None or dep.id == code or dep.id in seen:
                    continue  # 前置任務不存在（例如被刪除）或重複時略過
                seen.add(dep.id)
                db.add(DependencyRow(task_id=task_uuid[code], depends_on_task_id=target, reason=dep.reason))
    return task_uuid


def _save_backlog(
    db: Session,
    store: MemoryStore,
    snap: Snapshot,
    sprint_rows: dict[int, SprintRow],
    task_uuid: dict[str, uuid.UUID],
) -> None:
    project_id = snap.project_id
    by_name = {}
    for r in sprint_rows.values():
        by_name.setdefault(r.name, r.id)
    current = {b.id for b in store.backlog}
    gone = [uuid.UUID(i) for i in snap.backlog if i not in current]
    if gone:
        db.execute(delete(BacklogRow).where(BacklogRow.id.in_(gone)))
    now = datetime.now(UTC)
    for index, item in enumerate(store.backlog):
        before = snap.backlog.get(item.id)
        if before is not None and _dump(item) == before:
            continue
        used = sprint_rows.get(item.used_in_sprint_id) if item.used_in_sprint_id is not None else None
        row = db.get(BacklogRow, uuid.UUID(item.id)) if before is not None else None
        if row is None:  # 新的延續事項（流程用 b-xxxx 之類的暫時 id）
            row = BacklogRow(
                id=uuid.uuid4(),
                project_id=project_id,
                text=item.text,
                kind=item.kind,
                created_at=now + timedelta(microseconds=index),  # 同一個請求新增的，維持新增的先後順序
            )
            db.add(row)
        row.text = item.text
        row.kind = item.kind
        row.from_sprint_id = by_name.get(item.from_sprint)
        row.task_id = task_uuid.get(item.task_id) if item.task_id else None
        row.used_in_sprint_id = used.id if used else None
        row.decision = item.decision
        row.updated_at = now


def _save_plans(db: Session, store: MemoryStore, snap: Snapshot, task_uuid: dict[str, uuid.UUID]) -> None:
    gone = [task_uuid[c] for c in snap.plans if c not in store.plans and c in task_uuid]
    if gone:
        db.execute(delete(PlanRow).where(PlanRow.task_id.in_(gone)))
    for code, plan in store.plans.items():
        if _dump(plan) == snap.plans.get(code) or code not in task_uuid:
            continue
        row = db.get(PlanRow, task_uuid[code]) or PlanRow(task_id=task_uuid[code])
        db.add(row)
        row.checklist = [c.model_dump(mode="json", by_alias=True) for c in plan.checklist]
        row.checkpoints = [c.model_dump(mode="json", by_alias=True) for c in plan.checkpoints]
        row.dep_checks = [c.model_dump(mode="json", by_alias=True) for c in plan.dep_checks]
        row.origin = plan.origin
        row.edited = plan.edited
        row.confirmed_at = _datetime(plan.confirmed_at)
        row.updated_at = datetime.now(UTC)


def _save_threads(db: Session, store: MemoryStore, snap: Snapshot, task_uuid: dict[str, uuid.UUID]) -> None:
    now = datetime.now(UTC)
    for code, thread in store.threads.items():
        task_id = task_uuid.get(code)
        if task_id is None:
            continue
        state = ([list(c) for c in thread.clarifications], thread.cursor)
        if state != snap.threads.get(code) and (code in snap.threads or state != ([[]], 0)):
            row = db.get(ThreadRow, task_id) or ThreadRow(task_id=task_id)
            db.add(row)
            row.clarifications = state[0]
            row.cursor = state[1]
            row.updated_at = now
        known = snap.chat.get(code, set())
        for index, message in enumerate(m for m in thread.chat if m.id not in known):
            db.add(
                ChatRow(
                    id=uuid.uuid4(),
                    task_id=task_id,
                    role=message.role,
                    text=message.text,
                    sources=message.sources,
                    prompt_addition=message.prompt_addition,
                    prompt_version=message.prompt_version,
                    created_at=now + timedelta(microseconds=index),
                )
            )


def _save_notifications(db: Session, store: MemoryStore, snap: Snapshot, task_uuid: dict[str, uuid.UUID]) -> None:
    now = datetime.now(UTC)
    fresh = [n for n in store.notifications if n.id not in snap.notifications]
    # store.notify 把新通知插在最前面，所以反過來寫入，讓較舊的先寫（created_at 較早）
    for index, n in enumerate(reversed(fresh)):
        recipient = _uuid(n.to_id)
        if recipient is None:
            continue
        db.add(
            NotificationRow(
                id=uuid.uuid4(),
                recipient_member_id=recipient,
                sender_member_id=_uuid(n.from_id),
                type=n.type,
                task_id=task_uuid.get(n.task_id) if n.task_id else None,
                ref_id=_uuid(n.ref_id),
                text=n.text,
                status=n.status,
                created_at=now + timedelta(microseconds=index),
            )
        )
    for n in store.notifications:
        before = snap.notifications.get(n.id)
        if before is not None and before["status"] != n.status:
            row = db.get(NotificationRow, uuid.UUID(n.id))
            if row is not None:
                row.status = n.status
