"""Sprint 設定與延續事項。規則移植自前端 services/mock/tasks.ts（sprints）與 mocks/handlers/sprint.ts。"""

from datetime import date, timedelta

from app.core.errors import ApiError
from app.repo.memory import MemoryStore
from app.schemas.sprint import (
    AddSprintDocsBody,
    BacklogDecision,
    BacklogItem,
    CreateSprintInput,
    NewSprintDefaults,
    Sprint,
    SprintDoc,
    UpdateSprintInput,
)
from app.services.workspace_flow import format_size

CARRY_HEADER = "## 延續事項（系統自動帶入）"
"""會議紀錄中系統自動帶入的延續事項區塊標題（與前端 lib/planning.ts 相同）"""


def month_day(iso: str) -> str:
    _, month, day = iso.split("-")
    return f"{month}/{day}"


def add_days(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def _backlog_line(b: BacklogItem) -> str:
    if b.kind == "multi":
        return f"- [跨 Sprint] {b.text}（自 {b.from_sprint} 延續）"
    return f"- [延後] {b.text}（{b.from_sprint} 延後）"


def carry_block(items: list[BacklogItem]) -> str:
    return "\n".join([CARRY_HEADER, *map(_backlog_line, items)]) if items else ""


def replace_carry_block(minutes: str, block: str) -> str:
    """以新的延續事項區塊取代會議紀錄中原本的區塊（區塊固定放在最後）"""
    idx = minutes.find(CARRY_HEADER)
    body = (minutes[:idx] if idx >= 0 else minutes).rstrip()
    if not block:
        return body
    return f"{body}\n\n{block}" if body else block


def carry_over_text(store: MemoryStore, sprint_id: int | None = None) -> tuple[str, int]:
    """「上輪 Sprint 統整」選擇納入本輪、尚未寫進其他 Sprint 的延續事項"""
    items = [
        b
        for b in store.backlog
        if b.decision == "include" and (b.used_in_sprint_id is None or b.used_in_sprint_id == sprint_id)
    ]
    return carry_block(items), len(items)


def _sync_carry_block(store: MemoryStore, sprint_id: int) -> None:
    sprint = store.find_sprint(sprint_id)
    sprint.minutes = replace_carry_block(sprint.minutes, carry_over_text(store, sprint_id)[0])


def _clean_capacity(capacity: dict[str, int]) -> dict[str, int]:
    return {k: max(0, round(v)) for k, v in capacity.items()}


def list_sprints(store: MemoryStore) -> list[Sprint]:
    return sorted(store.sprints.values(), key=lambda s: s.id)


def defaults(store: MemoryStore) -> NewSprintDefaults:
    last = max(store.sprints.values(), key=lambda s: s.id)
    start = add_days(last.end_date, 1)
    text, count = carry_over_text(store)
    return NewSprintDefaults(
        id=last.id + 1,
        name=f"Sprint {last.id + 1}",
        start_date=start,
        end_date=add_days(start, 13),
        capacity={m.id: m.capacity for m in store.members},
        minutes=text,
        carry_count=count,
    )


def create(store: MemoryStore, body: CreateSprintInput) -> Sprint:
    if store.planning_sprint_id is not None:
        raise ApiError("已經有規劃中的 Sprint，請先完成或啟動它", status=409, code="CONFLICT")
    if not body.name.strip():
        raise ApiError("請輸入 Sprint 名稱")
    if not body.start_date or not body.end_date or body.end_date < body.start_date:
        raise ApiError("請確認起訖日期")
    sprint_id = max(store.sprints, default=0) + 1
    sprint = Sprint(
        id=sprint_id,
        name=body.name.strip(),
        start=month_day(body.start_date),
        end=month_day(body.end_date),
        start_date=body.start_date,
        end_date=body.end_date,
        goal=body.goal.strip(),
        status="planning",
        capacity=_clean_capacity(body.capacity),
        minutes=body.minutes,
        docs=list(body.docs),
        questions=None,
        step=2,
        summary=None,
    )
    store.sprints[sprint_id] = sprint
    store.planning_sprint_id = sprint_id
    # 選擇納入本輪的延續事項，標記為已帶入這個 Sprint
    for b in store.backlog:
        if b.used_in_sprint_id is None and b.decision == "include":
            b.used_in_sprint_id = sprint_id
    return sprint


def update(store: MemoryStore, sprint_id: int, patch: UpdateSprintInput) -> Sprint:
    sprint = store.find_sprint(sprint_id)
    locked = patch.name is not None or patch.start_date is not None or patch.end_date is not None
    if sprint.status != "planning" and (locked or patch.capacity is not None):
        raise ApiError("只有規劃中的 Sprint 可以修改名稱、日期與 Capacity")
    if patch.name is not None and not patch.name.strip():
        raise ApiError("請輸入 Sprint 名稱")
    start = patch.start_date or sprint.start_date
    end = patch.end_date or sprint.end_date
    if not start or not end or end < start:
        raise ApiError("請確認起訖日期")
    if patch.name is not None:
        sprint.name = patch.name.strip()
    sprint.start_date, sprint.end_date = start, end
    sprint.start, sprint.end = month_day(start), month_day(end)
    if patch.goal is not None:
        sprint.goal = patch.goal.strip()
    if patch.capacity is not None:
        sprint.capacity = _clean_capacity(patch.capacity)
    if patch.minutes is not None:
        sprint.minutes = patch.minutes
    if patch.docs is not None:
        sprint.docs = list(patch.docs)
    return sprint


def add_docs(store: MemoryStore, sprint_id: int, body: AddSprintDocsBody) -> Sprint:
    sprint = store.find_sprint(sprint_id)
    sprint.docs.extend(SprintDoc(name=f.name, size=format_size(f.size)) for f in body.files)
    return sprint


def decide_backlog(store: MemoryStore, item_id: str, decision: BacklogDecision | None) -> BacklogItem:
    item = next((b for b in store.backlog if b.id == item_id), None)
    if item is None:
        raise ApiError("找不到這個延續事項", status=404, code="NOT_FOUND")
    planning_id = store.planning_sprint_id
    if item.used_in_sprint_id is not None and item.used_in_sprint_id != planning_id:
        raise ApiError("這個延續事項已經帶入其他 Sprint", status=409, code="CONFLICT")
    item.decision = decision
    if planning_id is not None:  # 已有規劃中的 Sprint：直接同步它的會議紀錄延續區塊
        item.used_in_sprint_id = planning_id if decision == "include" else None
        _sync_carry_block(store, planning_id)
    return item


def remove_backlog(store: MemoryStore, item_id: str) -> None:
    store.backlog = [b for b in store.backlog if b.id != item_id]
