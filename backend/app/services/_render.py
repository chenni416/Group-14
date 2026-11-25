"""把資料整理成給模型看的文字。使用者提供的內容一律放進標籤區塊，與指令分開。"""

from app.schemas.member import Member
from app.schemas.task import Task


def block(tag: str, content: str) -> str:
    return f"<{tag}>\n{content.strip() or '（無）'}\n</{tag}>"


def members_text(members: list[Member], loads: dict[str, int] | None = None) -> str:
    """[v0.3 修改] 多列出「剩餘」點數（capacity − 已分配），模型不用自己減法。

    Prompt 測試 C09（R4）：只給 capacity 與已分配時，模型把 5 點任務指派給剩 2 點的成員（指派後 13/10）。
    """
    loads = loads or {}
    return "\n".join(
        f"{m.id} | {m.name} | {m.domain} | 技能：{', '.join(m.tags) or '無'} | "
        f"capacity {m.capacity} 點 | 已分配 {loads.get(m.id, 0)} 點 | 剩餘 {m.capacity - loads.get(m.id, 0)} 點"
        for m in members
    )


def task_text(t: Task) -> str:
    ac = "\n".join(f"    {i}. {a}" for i, a in enumerate(t.acceptance_criteria))
    deps = ", ".join(d.id for d in t.depends_on) or "無"
    return (
        f"{t.id} | {t.domain} | {t.story_points} 點 | 狀態 {t.state} | {t.title}\n"
        f"  目標：{t.description or '（未填）'}\n"
        f"  範圍：{t.scope or '（未填）'}；不在範圍：{t.out_of_scope or '（未填）'}\n"
        f"  預期成果：{'、'.join(t.deliverables) or '（未填）'}\n"
        f"  依賴：{deps}\n"
        f"  驗收條件：\n{ac}"
    )
