"""組織、專案、成員、知識庫文件與通知。規則移植自前端 services/mock/workspace.ts，資料暫存在記憶體（MemoryStore）。"""

import re

from app.core.errors import ApiError
from app.repo.memory import MemoryStore
from app.schemas.collab import Notification
from app.schemas.member import InviteMemberInput, Member, UpdateMemberInput
from app.schemas.project import (
    AddLinkBody,
    KnowledgeDoc,
    Project,
    SearchHit,
    UpdateProjectInput,
    UploadDocsBody,
)

# ---------- 通知 ----------


def list_notifications(store: MemoryStore, me: Member) -> list[Notification]:
    return [n for n in store.notifications if n.to_id == me.id]


# ---------- 專案 ----------


def update_project(store: MemoryStore, patch: UpdateProjectInput) -> Project:
    changes = {k: getattr(patch, k) for k in patch.model_fields_set}
    if changes.get("prefix") is not None:
        changes["prefix"] = re.sub(r"[^A-Z0-9]", "", changes["prefix"].upper()) or "TL"
    assert store.project is not None
    store.project = store.project.model_copy(update=changes)
    return store.current_project()


# ---------- 成員 ----------


def invite_member(store: MemoryStore, body: InviteMemberInput) -> Member:
    if not body.name.strip():
        raise ApiError("請輸入姓名")
    member = Member(
        id=f"m{store.uid()}",
        name=body.name.strip(),
        email=body.email or "—",
        role=body.role,
        title=body.title,
        domain=body.domain,
        tags=body.tags,
        capacity=max(1, body.capacity),
    )
    store.members.append(member)
    return member


def update_member(store: MemoryStore, member_id: str, patch: UpdateMemberInput) -> Member:
    member = store.find_member(member_id)
    changes = {k: getattr(patch, k) for k in patch.model_fields_set}
    if changes.get("role") == "Leader":  # 一個專案只有一位 Leader
        for m in store.members:
            if m.id != member_id and m.role == "Leader":
                m.role = "Member"
    if changes.get("capacity") is not None:
        changes["capacity"] = max(1, changes["capacity"])
    for key, value in changes.items():
        setattr(member, key, value)
    return member


# ---------- 知識庫文件 ----------

_DOC_KINDS = (
    (r"prd", "PRD"),
    (r"api|openapi|swagger", "API 規格"),
    (r"readme", "README"),
    (r"standard|style|lint", "Coding Standards"),
    (r"png|jpg|svg|drawio|arch|架構", "架構圖"),
)


def guess_doc_kind(name: str) -> str:
    return next((kind for pattern, kind in _DOC_KINDS if re.search(pattern, name, re.IGNORECASE)), "文件")


def format_size(size: int) -> str:
    return f"{size / 1e6:.1f} MB" if size > 1e6 else f"{max(1, round(size / 1e3))} KB"


def _add_doc(store: MemoryStore, name: str, kind: str, size: str, is_link: bool) -> KnowledgeDoc:
    # 真實後端會在背景索引、逐步增加進度；目前沒有 RAG，直接視為處理完成
    doc = KnowledgeDoc(
        id=store.uid(), name=name, kind=kind, size=size, progress=100, chunks=5 + len(name) % 30, is_link=is_link
    )
    store.knowledge_docs.append(doc)
    return doc


def upload_docs(store: MemoryStore, body: UploadDocsBody) -> list[KnowledgeDoc]:
    return [_add_doc(store, f.name, guess_doc_kind(f.name), format_size(f.size), False) for f in body.files]


def add_link(store: MemoryStore, body: AddLinkBody) -> KnowledgeDoc:
    url = body.url
    if re.search("figma", url, re.IGNORECASE):
        kind = "Figma"
    elif re.search("notion", url, re.IGNORECASE):
        kind = "Notion"
    elif re.search("github", url, re.IGNORECASE):
        kind = "README"
    else:
        kind = "連結"
    return _add_doc(store, re.sub(r"^https?://", "", url)[:40], kind, "連結", True)


def remove_doc(store: MemoryStore, doc_id: str) -> None:
    store.knowledge_docs = [d for d in store.knowledge_docs if d.id != doc_id]


def search_docs(query: str) -> list[SearchHit]:
    """假的檢索（RAG 完成前）：依關鍵字回傳固定片段，規則同前端 mocks/handlers/knowledge.ts"""
    hits: list[SearchHit] = []
    if re.search(r"webhook|驗證|簽章|API|JWT", query, re.IGNORECASE):
        hits.append(
            SearchHit(
                source="openapi.yaml",
                excerpt="§webhooks：驗證 X-Hub-Signature-256（HMAC SHA-256），失敗回傳 401。",
                score=0.92,
            )
        )
    if re.search(r"測試|CI|test", query, re.IGNORECASE):
        hits.append(
            SearchHit(source="README.md", excerpt="§CI：PR 觸發 lint + unit + e2e，E2E 使用 Playwright。", score=0.88)
        )
    if re.search(r"UI|設計|樣式|Figma", query, re.IGNORECASE):
        hits.append(
            SearchHit(source="Figma · Taskline UI Kit v2", excerpt="卡片圓角 16/24px，主色 #111827。", score=0.85)
        )
    if not hits:
        hits.append(
            SearchHit(source="PRD_v2.md", excerpt="§1 產品目標：讓會議決議自動轉為可追蹤、可交付的任務。", score=0.61)
        )
    hits.append(SearchHit(source="CODING_STANDARDS.md", excerpt="§2 命名與資料夾結構規範。", score=0.54))
    return hits[:3]
