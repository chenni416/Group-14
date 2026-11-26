"""Sprint 與延續事項（資料庫版）：sprints、backlog_items、documents（Sprint 的會議文件）。

與 `sprint_flow.py`（記憶體版，只給示範成員 X-Demo-User 用）規則相同，差別只在資料來源：
- 每個查詢都帶 project_id，不同專案的 Sprint 互不影響（記憶體版是全域一份）
- API 的 Sprint.id 是專案內的流水號（sprints.number），資料表主鍵是 uuid，只在這個檔案內轉換
- 每個專案同時最多一個「規劃中」與一個「進行中」的 Sprint（資料庫的部分唯一索引保證）

還沒接資料庫的部分（等任務、規劃改存資料庫後再做）：
- 延續事項的 task_id（任務還在記憶體，沒有 tasks 資料列可以指）
- Sprint 啟動／結束（sprints.start、sprints.end）
"""

import re
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.llm import LlmClient
from app.core.errors import ApiError
from app.models import BacklogItem as BacklogRow
from app.models import Document as DocumentRow
from app.models import ProjectMember as ProjectMemberRow
from app.models import Sprint as SprintRow
from app.schemas.sprint import (
    AddSprintDocsBody,
    AnalyzeResult,
    BacklogDecision,
    BacklogItem,
    ClarifyQuestion,
    CreateSprintInput,
    NewSprintDefaults,
    Sprint,
    SprintDoc,
    UpdateSprintInput,
)
from app.services import sprint_ai
from app.services.sprint_flow import add_days, carry_block, month_day, replace_carry_block
from app.services.workspace_flow import format_size

NAME_MAX = 100


# ---------- 轉換 ----------


def _size_bytes(size: str) -> int:
    """SprintDoc.size 是顯示用文字（"38 KB"、"1.2 MB"），資料表存 bytes"""
    m = re.match(r"^\s*([\d.]+)\s*(KB|MB)\s*$", size, re.IGNORECASE)
    if m is None:
        return 0
    return round(float(m.group(1)) * (1e6 if m.group(2).upper() == "MB" else 1e3))


def _docs(db: Session, sprint: SprintRow) -> list[SprintDoc]:
    rows = db.scalars(
        select(DocumentRow).where(DocumentRow.sprint_id == sprint.id).order_by(DocumentRow.created_at, DocumentRow.name)
    ).all()
    return [SprintDoc(name=r.name, size=format_size(r.size_bytes or 0)) for r in rows]


def _questions(row: SprintRow) -> list[ClarifyQuestion] | None:
    if row.clarify_questions is None:
        return None
    return [ClarifyQuestion(**q) for q in row.clarify_questions]


def to_schema(db: Session, row: SprintRow) -> Sprint:
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
        docs=_docs(db, row),
        questions=_questions(row),
        step=row.planning_step,  # type: ignore[arg-type]
        summary=row.summary,  # type: ignore[arg-type]
    )


def _clean_capacity(capacity: dict[str, int]) -> dict[str, int]:
    return {k: max(0, round(v)) for k, v in capacity.items()}


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ApiError("請確認起訖日期", status=422, code="VALIDATION_ERROR") from None


def _check_range(start: str, end: str) -> tuple[date, date]:
    if not start or not end:
        raise ApiError("請確認起訖日期", status=422, code="VALIDATION_ERROR")
    start_date, end_date = _parse_date(start), _parse_date(end)
    if end_date < start_date:
        raise ApiError("請確認起訖日期", status=422, code="VALIDATION_ERROR")
    return start_date, end_date


# ---------- 查詢 ----------


def find(db: Session, project_id: uuid.UUID, number: int) -> SprintRow:
    row = db.scalar(select(SprintRow).where(SprintRow.project_id == project_id, SprintRow.number == number))
    if row is None:
        raise ApiError("找不到這個 Sprint", status=404, code="NOT_FOUND")
    return row


def _planning(db: Session, project_id: uuid.UUID) -> SprintRow | None:
    return db.scalar(select(SprintRow).where(SprintRow.project_id == project_id, SprintRow.status == "planning"))


def list_sprints(db: Session, project_id: uuid.UUID) -> list[Sprint]:
    rows = db.scalars(select(SprintRow).where(SprintRow.project_id == project_id).order_by(SprintRow.number)).all()
    return [to_schema(db, r) for r in rows]


def get(db: Session, project_id: uuid.UUID, number: int) -> Sprint:
    return to_schema(db, find(db, project_id, number))


# ---------- 延續事項 ----------


def _backlog_schema(db: Session, row: BacklogRow) -> BacklogItem:
    from_name = (
        db.scalar(select(SprintRow.name).where(SprintRow.id == row.from_sprint_id)) if row.from_sprint_id else ""
    )
    used = (
        db.scalar(select(SprintRow.number).where(SprintRow.id == row.used_in_sprint_id))
        if row.used_in_sprint_id
        else None
    )
    return BacklogItem(
        id=str(row.id),
        text=row.text,
        from_sprint=from_name or "",
        kind=row.kind,  # type: ignore[arg-type]
        task_id=None,  # 任務改存資料庫後，改成 tasks.code
        used_in_sprint_id=used,
        decision=row.decision,  # type: ignore[arg-type]
    )


def list_backlog(db: Session, project_id: uuid.UUID) -> list[BacklogItem]:
    rows = db.scalars(
        select(BacklogRow)
        .where(BacklogRow.project_id == project_id)
        .order_by(BacklogRow.created_at, BacklogRow.text, BacklogRow.id)
    ).all()
    return [_backlog_schema(db, r) for r in rows]


def _included(db: Session, project_id: uuid.UUID, sprint: SprintRow | None) -> list[BacklogRow]:
    """「上輪統整」選擇納入本輪、尚未寫進其他 Sprint 的延續事項"""
    used_ok = BacklogRow.used_in_sprint_id.is_(None)
    if sprint is not None:
        used_ok = used_ok | (BacklogRow.used_in_sprint_id == sprint.id)
    return list(
        db.scalars(
            select(BacklogRow)
            .where(BacklogRow.project_id == project_id, BacklogRow.decision == "include", used_ok)
            .order_by(BacklogRow.created_at, BacklogRow.text, BacklogRow.id)
        ).all()
    )


def _carry_text(db: Session, project_id: uuid.UUID, sprint: SprintRow | None) -> tuple[str, int]:
    items = [_backlog_schema(db, r) for r in _included(db, project_id, sprint)]
    return carry_block(items), len(items)


def _sync_carry_block(db: Session, sprint: SprintRow) -> None:
    sprint.minutes = replace_carry_block(sprint.minutes, _carry_text(db, sprint.project_id, sprint)[0])


def _find_backlog(db: Session, project_id: uuid.UUID, item_id: str) -> BacklogRow:
    try:
        target = uuid.UUID(item_id)
    except ValueError:
        target = None
    row = db.get(BacklogRow, target) if target else None
    if row is None or row.project_id != project_id:
        raise ApiError("找不到這個延續事項", status=404, code="NOT_FOUND")
    return row


def decide_backlog(db: Session, project_id: uuid.UUID, item_id: str, decision: BacklogDecision | None) -> BacklogItem:
    item = _find_backlog(db, project_id, item_id)
    planning = _planning(db, project_id)
    if item.used_in_sprint_id is not None and (planning is None or item.used_in_sprint_id != planning.id):
        raise ApiError("這個延續事項已經帶入其他 Sprint", status=409, code="CONFLICT")
    item.decision = decision
    if planning is not None:  # 已有規劃中的 Sprint：直接同步它的會議紀錄延續區塊
        item.used_in_sprint_id = planning.id if decision == "include" else None
        db.flush()
        _sync_carry_block(db, planning)
    db.commit()
    return _backlog_schema(db, item)


def remove_backlog(db: Session, project_id: uuid.UUID, item_id: str) -> None:
    db.delete(_find_backlog(db, project_id, item_id))
    db.commit()


# ---------- Sprint ----------


def defaults(db: Session, project_id: uuid.UUID) -> NewSprintDefaults:
    last = db.scalar(select(SprintRow).where(SprintRow.project_id == project_id).order_by(SprintRow.number.desc()))
    capacity = {
        str(member_id): cap
        for member_id, cap in db.execute(
            select(ProjectMemberRow.member_id, ProjectMemberRow.capacity).where(
                ProjectMemberRow.project_id == project_id
            )
        )
    }
    text, count = _carry_text(db, project_id, None)
    if last is None:  # 專案的第一個 Sprint：從今天開始，兩週
        start = date.today().isoformat()
        number = 1
    else:
        start = add_days(last.end_date.isoformat(), 1)
        number = last.number + 1
    return NewSprintDefaults(
        id=number,
        name=f"Sprint {number}",
        start_date=start,
        end_date=add_days(start, 13),
        capacity=capacity,
        minutes=text,
        carry_count=count,
    )


def _replace_docs(db: Session, sprint: SprintRow, docs: list[SprintDoc], member_id: uuid.UUID | None) -> None:
    """用 docs 取代 Sprint 的會議文件：名稱與大小都相同的保留原本的資料列，其餘新增或刪除"""
    pool: dict[tuple[str, str], list[DocumentRow]] = {}
    for row in db.scalars(select(DocumentRow).where(DocumentRow.sprint_id == sprint.id)):
        pool.setdefault((row.name, format_size(row.size_bytes or 0)), []).append(row)
    for doc in docs:
        bucket = pool.get((doc.name, doc.size))
        if bucket:
            bucket.pop()
        else:
            _add_doc(db, sprint, doc.name, _size_bytes(doc.size), member_id)
    for leftover in pool.values():
        for row in leftover:
            db.delete(row)


def _add_doc(db: Session, sprint: SprintRow, name: str, size_bytes: int, member_id: uuid.UUID | None) -> None:
    name = name.strip()[:200]
    if not name:
        raise ApiError("檔名不能是空的", status=422, code="VALIDATION_ERROR")
    doc_id = uuid.uuid4()
    db.add(
        DocumentRow(
            id=doc_id,
            project_id=sprint.project_id,
            sprint_id=sprint.id,
            name=name,
            kind="會議文件",
            is_link=False,
            storage_path=f"{sprint.project_id}/sprints/{sprint.number}/{doc_id}/{name}",
            size_bytes=max(0, size_bytes),
            index_progress=100,
            uploaded_by_member_id=member_id,
        )
    )


def create(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, body: CreateSprintInput) -> Sprint:
    name = body.name.strip()
    if not name:
        raise ApiError("請輸入 Sprint 名稱", status=422, code="VALIDATION_ERROR")
    if len(name) > NAME_MAX:
        raise ApiError(f"Sprint 名稱最多 {NAME_MAX} 個字", status=422, code="VALIDATION_ERROR")
    start, end = _check_range(body.start_date, body.end_date)
    if _planning(db, project_id) is not None:
        raise ApiError("已經有規劃中的 Sprint，請先完成或啟動它", status=409, code="CONFLICT")
    last = db.scalar(
        select(SprintRow.number).where(SprintRow.project_id == project_id).order_by(SprintRow.number.desc())
    )
    row = SprintRow(
        project_id=project_id,
        number=(last or 0) + 1,
        name=name,
        start_date=start,
        end_date=end,
        goal=body.goal.strip(),
        status="planning",
        capacity=_clean_capacity(body.capacity),
        minutes=body.minutes,
        clarify_questions=None,
        planning_step=2,
        summary=None,
    )
    db.add(row)
    try:
        db.flush()  # 兩個人同時建立時，由部分唯一索引擋下第二個
    except IntegrityError:
        db.rollback()
        raise ApiError("已經有規劃中的 Sprint，請先完成或啟動它", status=409, code="CONFLICT") from None
    for doc in body.docs:
        _add_doc(db, row, doc.name, _size_bytes(doc.size), member_id)
    # 選擇納入本輪的延續事項，標記為已帶入這個 Sprint
    for item in _included(db, project_id, None):
        item.used_in_sprint_id = row.id
    db.commit()
    return to_schema(db, row)


def update(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, number: int, patch: UpdateSprintInput) -> Sprint:
    row = find(db, project_id, number)
    locked = patch.name is not None or patch.start_date is not None or patch.end_date is not None
    if row.status != "planning" and (locked or patch.capacity is not None):
        raise ApiError("只有規劃中的 Sprint 可以修改名稱、日期與 Capacity", status=409, code="CONFLICT")
    if patch.name is not None:
        name = patch.name.strip()
        if not name:
            raise ApiError("請輸入 Sprint 名稱", status=422, code="VALIDATION_ERROR")
        if len(name) > NAME_MAX:
            raise ApiError(f"Sprint 名稱最多 {NAME_MAX} 個字", status=422, code="VALIDATION_ERROR")
        row.name = name
    start, end = _check_range(
        patch.start_date or row.start_date.isoformat(), patch.end_date or row.end_date.isoformat()
    )
    row.start_date, row.end_date = start, end
    if patch.goal is not None:
        row.goal = patch.goal.strip()
    if patch.capacity is not None:
        row.capacity = _clean_capacity(patch.capacity)
    if patch.minutes is not None:
        row.minutes = patch.minutes
    if patch.docs is not None:
        _replace_docs(db, row, patch.docs, member_id)
    db.commit()
    return to_schema(db, row)


def add_docs(db: Session, project_id: uuid.UUID, member_id: uuid.UUID, number: int, body: AddSprintDocsBody) -> Sprint:
    row = find(db, project_id, number)
    for f in body.files:
        _add_doc(db, row, f.name, f.size, member_id)
    db.commit()
    return to_schema(db, row)


# ---------- 會議紀錄分析 ----------


def analyze(db: Session, project_id: uuid.UUID, number: int, minutes: str, llm: LlmClient) -> AnalyzeResult:
    row = find(db, project_id, number)
    questions = sprint_ai.analyze_questions(minutes, row.goal, llm)
    # 重新分析時，保留已回答過的相同問題
    answered = {q.question: q.answer for q in _questions(row) or [] if q.answer}
    for q in questions:
        q.answer = answered.get(q.question, "")
    row.minutes = minutes
    row.clarify_questions = [q.model_dump() for q in questions]
    db.commit()
    return AnalyzeResult(unanswered=sum(1 for q in questions if not q.answer))


def answer_question(db: Session, project_id: uuid.UUID, number: int, question_id: str, answer: str) -> Sprint:
    row = find(db, project_id, number)
    questions = _questions(row) or []
    q = next((x for x in questions if x.id == question_id), None)
    if q is None:
        raise ApiError("找不到這個問題", status=404, code="NOT_FOUND")
    q.answer = answer.strip()
    row.clarify_questions = [x.model_dump() for x in questions]  # 整個換掉，JSONB 才會偵測到變更
    db.commit()
    return to_schema(db, row)
