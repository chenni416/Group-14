"""Story → Task 拆解、Story 微調對話、容量延後與重新平衡（皆為草稿，不寫入資料庫）"""

import re

from app.ai import audit
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmDeferral, LlmTaskDraft
from app.core.errors import ApiError
from app.schemas.member import Member
from app.schemas.planning import (
    DraftDependency,
    GenerateTasksInput,
    ReviewerAssignment,
    StoryAssistantBody,
    StoryDraft,
    TaskDraft,
)
from app.services._render import block
from app.services.assignment import suggest_assignments

NO_MEMBERS_REASON = "尚無成員資料，無法提供指派建議，請依成員技能與負載自行指派。"

TASK_POINT_OPTIONS = (1, 2, 3, 5, 8)
"""[v0.2 修改] Task 點數只能是這些值，與前端 lib/constants.ts 的 STORY_POINT_OPTIONS 相同（最大 8）"""


def _snap_points(raw: int) -> int:
    """[v0.2 修改] 把模型給的點數調整到最近的允許值（向上取，最大 8）。

    修改前是夾在 1–13，可能出現 4、13 等前端選不到的值。
    """
    return next((p for p in TASK_POINT_OPTIONS if p >= raw), TASK_POINT_OPTIONS[-1])


def task_code(sprint_id: int, story_no: int, no: int) -> str:
    """與前端 lib/planning.ts 的 taskCode 一致：S-{Sprint}{Story 序號}{Task 序號}"""
    return f"S-{sprint_id}{story_no}{no}"


def _clarify_lines(story: StoryDraft) -> list[str]:
    """[v0.2 修改] Leader 在 Story 審核時的決定，傳給拆 Task 的模型。

    - 已回答的提問：問題 → 答案，並把 effect 範本中的 {answer} 換成答案，作為要寫進驗收條件的句子
    - 採用的建議：建議內容與採用後的改動
    - 不採用的建議、尚未回答的提問：不傳（避免模型照著做）
    修改前 _stories_text 只輸出標題、使用情境與範疇，這些回答完全沒有傳給模型。
    """
    lines: list[str] = []
    for c in story.clarify or []:
        if c.kind == "question" and (c.answer or "").strip():
            answer = c.answer.strip()
            criterion = c.effect.replace("{answer}", answer) if "{answer}" in c.effect else f"{c.effect}：{answer}"
            lines.append(f"  已釐清：{c.text} → {answer}（驗收條件：{criterion}）")
        elif c.kind == "suggestion" and c.decision == "accept":
            lines.append(f"  採用建議：{c.text}（{c.effect}）")
    return lines


def _stories_text(stories: list[StoryDraft]) -> str:
    return "\n\n".join(
        "\n".join(
            [
                f"Story no={s.no}｜{s.title}（{s.story_points} 點）",
                f"  使用情境：{s.user_story}",
                f"  範疇：{'；'.join(s.scope) or '（未列）'}",
                *_clarify_lines(s),  # [v0.2 修改]
            ]
        )
        for s in stories
    )


def _slug(raw: str, no: int) -> str:
    return re.sub(r"[^a-z0-9]+", "-", raw.lower()).strip("-") or f"task-{no}"


def _drop_cycles(deps: dict[str, list[DraftDependency]]) -> None:
    """依序加入依賴，會造成循環的那一條丟掉（模型偶爾會給出互相依賴）"""
    kept: dict[str, list[DraftDependency]] = {k: [] for k in deps}

    def reaches(start: str, target: str) -> bool:
        stack, seen = [start], set()
        while stack:
            cur = stack.pop()
            if cur == target:
                return True
            if cur in seen:
                continue
            seen.add(cur)
            stack.extend(d.id for d in kept.get(cur, []))
        return False

    for task_id, items in deps.items():
        for d in items:
            if not reaches(d.id, task_id):
                kept[task_id].append(d)
            else:
                audit.note(
                    "drop_dependency_cycle",
                    f"移除會造成循環的相依：{task_id} → {d.id}",
                    task=task_id,
                    depends_on=d.id,
                    reason=d.reason,
                )
    deps.update(kept)


def generate_tasks(
    body: GenerateTasksInput,
    members: list[Member],
    llm: LlmClient,
    *,
    loads: dict[str, int] | None = None,
    sprint_answers: list[str] | None = None,
) -> list[TaskDraft]:
    """[v0.2 修改] 新增兩個參數：

    - loads：每位成員在這批 Task 之前已承擔的點數（上一輪帶入＋已確定的任務），傳給指派建議
    - sprint_answers：Sprint 層級待釐清問題的回答（「問題 → 答案」），以 <clarifications> 區塊傳給模型
    """
    stories = {s.no: s for s in body.stories if not s.deferred}
    if not stories:
        raise ApiError("請先建立至少一個 Story（已延後的 Story 不會拆解）")

    def ask(items: list[StoryDraft]) -> LlmTaskDraft:
        user = block("stories", _stories_text(items))
        if sprint_answers:  # [v0.2 修改]
            user += "\n\n" + block("clarifications", "\n".join(f"- {a}" for a in sprint_answers))
        return llm.generate_json(system=load_prompt("generate_tasks"), user=user, schema=LlmTaskDraft)

    result = ask(list(stories.values()))

    counters: dict[int, int] = {}
    keyed: dict[tuple[int, int], str] = {}  # (story_no, task_no) → draft id
    drafts: list[TaskDraft] = []
    raws = [t for t in result.tasks if t.story_no in stories]
    if len(raws) != len(result.tasks):
        bad = [(t.story_no, t.title) for t in result.tasks if t.story_no not in stories]
        audit.note("drop_unknown_story_tasks", f"捨棄 story_no 不存在的 Task：{bad}", dropped=bad)
    # 每個 Story 都要有 Task：模型偶爾會整個漏掉某些 Story（例如把標題有「延後」字樣的當成已延後），
    # 漏掉的針對那幾個 Story 再拆一次，不然這些需求會悄悄消失
    missing = [n for n in stories if n not in {t.story_no for t in raws}]
    if missing:
        audit.note(
            "retry_uncovered_stories",
            f"模型沒有為 Story {missing} 拆出任何 Task，針對這些 Story 再拆一次",
            stories=missing,
        )
        retry = ask([stories[n] for n in missing])
        raws = sorted(raws + [t for t in retry.tasks if t.story_no in missing], key=lambda t: t.story_no)
        still = [n for n in missing if n not in {t.story_no for t in raws}]
        if still:
            audit.note("uncovered_stories", f"重試後 Story {still} 仍然沒有 Task，請 Leader 手動新增", stories=still)
    for raw in raws:
        story = stories[raw.story_no]
        no = counters[story.no] = counters.get(story.no, 0) + 1
        draft_id = f"{story.id}-tk-{no}"
        keyed[(story.no, no)] = draft_id
        points = _snap_points(raw.story_points)
        if points != raw.story_points:
            audit.note(
                "snap_story_points",
                f"{draft_id}「{raw.title.strip()}」：點數 {raw.story_points} 調整為 {points}（只允許 1、2、3、5、8）",
                task=draft_id,
                raw=raw.story_points,
                adjusted=points,
            )
        slug = _slug(raw.branch_slug, no)
        if slug != raw.branch_slug:
            audit.note(
                "normalize_branch_slug",
                f"{draft_id}：branch_slug「{raw.branch_slug}」整理為「{slug}」",
                task=draft_id,
                raw=raw.branch_slug,
                adjusted=slug,
            )
        drafts.append(
            TaskDraft(
                id=draft_id,
                story_id=story.id,
                no=no,
                code=task_code(body.sprint_id, story.no, no),
                title=raw.title.strip(),
                domain=raw.domain,
                branch_prefix=raw.branch_prefix,
                branch_slug=slug,
                story_points=points,  # [v0.2 修改] 最大 8
                acceptance_criteria=[a.strip() for a in raw.acceptance_criteria if a.strip()],
                assignee_id=None,
                suggested_assignee_id=None,
                reviewer=ReviewerAssignment(mode=raw.reviewer_mode, member_id=None),
                analysis=raw.analysis,
                assign_reason=NO_MEMBERS_REASON,
                depends_on=[],
            )
        )
    if not drafts:
        audit.note("empty_result", "模型沒有拆出任何可用的 Task，回傳 422")
        raise ApiError("AI 沒有拆出任何 Task，請確認 Story 的範疇後再試", status=422, code="AI_EMPTY_RESULT")

    # 依賴：只保留指向存在的其他 Task 的項目，再去掉循環
    deps: dict[str, list[DraftDependency]] = {}
    for raw, draft in zip(raws, drafts, strict=True):
        deps[draft.id] = [
            DraftDependency(id=keyed[(d.story_no, d.task_no)], reason=d.reason)
            for d in raw.depends_on
            if (d.story_no, d.task_no) in keyed and keyed[(d.story_no, d.task_no)] != draft.id
        ]
        bad_deps = [
            (d.story_no, d.task_no)
            for d in raw.depends_on
            if not ((d.story_no, d.task_no) in keyed and keyed[(d.story_no, d.task_no)] != draft.id)
        ]
        if bad_deps:
            audit.note(
                "drop_unknown_task_dependencies",
                f"{draft.id}：捨棄指向不存在或自己的相依 {bad_deps}",
                task=draft.id,
                dropped=bad_deps,
            )
    _drop_cycles(deps)
    for draft in drafts:
        draft.depends_on = deps[draft.id]

    if members:
        assigned = suggest_assignments(drafts, members, llm, loads=loads)  # [v0.2 修改] 帶入既有負載
        for draft in drafts:
            if draft.code in assigned:
                draft.suggested_assignee_id, draft.assign_reason = assigned[draft.code]
            else:
                draft.assign_reason = "AI 沒有給出合適的人選，請自行指派。"
                audit.note(
                    "no_assignee", f"{draft.code}：模型沒有給出有效的人選，留空請 Leader 自行指派", task=draft.code
                )
    return drafts


def story_assistant_reply(body: StoryAssistantBody, goal: str, stories: list[StoryDraft], llm: LlmClient) -> str:
    question = body.question.strip()
    if not question:
        raise ApiError("請輸入問題")
    focus = body.story_title or "（未指定，指整體切分）"
    user = "\n\n".join(
        [
            block("sprint_goal", goal),
            block("stories", _stories_text([s for s in stories if not s.deferred])),  # [v0.2 修改] 不含已延後的 Story
            block("focus_story", focus),
            block("question", question),
        ]
    )
    return llm.generate_text(system=load_prompt("story_assistant"), user=user).strip()


def defer_suggested(
    drafts: list[TaskDraft], goal: str, members: list[Member], llm: LlmClient, committed: int = 0
) -> list[str]:
    """依容量建議延後的 Task id（含依賴它們的 Task）。未超過容量回傳空陣列

    [v0.2 修改] committed：不能延後、但會占用容量的點數（上一輪帶入＋已確定的任務）。
    修改前只加總草稿點數，帶入任務多時會誤判「沒有超過 capacity」。
    """
    capacity = sum(m.capacity for m in members)
    active = [d for d in drafts if not d.deferred]
    total = committed + sum(d.story_points for d in active)
    if capacity <= 0 or total <= capacity:
        return []

    lines = "\n".join(
        f"{d.id} | {d.story_points} 點 | {d.title} | 依賴：{', '.join(x.id for x in d.depends_on) or '無'}"
        for d in active
    )
    result = llm.generate_json(
        system=load_prompt("defer_tasks"),
        user=block("sprint_goal", goal)
        + "\n\n"
        + block(
            "capacity",
            f"團隊 capacity {capacity} 點；目前共 {total} 點，超出 {total - capacity} 點"
            + (f"（其中 {committed} 點為上一輪帶入與已確定的任務，不在下方清單中、不可延後）" if committed else ""),
        )
        + "\n\n"
        + block("tasks", lines),
        schema=LlmDeferral,
    )
    ids = {d.id for d in active}
    deferred = {i for i in result.task_ids if i in ids}
    unknown = [i for i in result.task_ids if i not in ids]
    if unknown:
        audit.note("drop_unknown_deferral_ids", f"捨棄不存在的延後 Task id：{unknown}", dropped=unknown)
    model_choice = set(deferred)
    # 依賴被延後任務的 Task 也必須一起延後，否則會卡住
    changed = True
    while changed:
        changed = False
        for d in active:
            if d.id not in deferred and any(x.id in deferred for x in d.depends_on):
                deferred.add(d.id)
                changed = True
    added = sorted(deferred - model_choice)
    if added:
        audit.note("add_dependent_deferrals", f"依賴被延後任務的 Task 一併延後：{added}", added=added)
    return [d.id for d in active if d.id in deferred]


def rebalance(
    drafts: list[TaskDraft],
    members: list[Member],
    llm: LlmClient,
    locked: frozenset[str] = frozenset(),
    base_loads: dict[str, int] | None = None,
) -> int:
    """重新平衡指派，只調整 Leader 沒動過的草稿（沒有指派，或指派等於 AI 原本的建議，且不在 locked 內）。回傳調整數

    [v0.2 修改] base_loads：草稿以外已確定的負載（上一輪帶入＋已確定的任務），會和鎖定草稿的點數加在一起。
    """
    if not members:
        raise ApiError("尚無成員資料，無法重新平衡", status=409, code="NO_MEMBERS")
    movable = [
        d
        for d in drafts
        if not d.deferred and d.id not in locked and (d.assignee_id is None or d.assignee_id == d.suggested_assignee_id)
    ]
    movable_ids = {d.id for d in movable}
    locked_loads: dict[str, int] = dict(base_loads or {})  # [v0.2 修改]
    for d in drafts:
        if not d.deferred and d.id not in movable_ids and d.assignee_id:
            locked_loads[d.assignee_id] = locked_loads.get(d.assignee_id, 0) + d.story_points
    assigned = suggest_assignments(movable, members, llm, loads=locked_loads)
    updated = 0
    for d in movable:
        if d.code not in assigned:
            continue
        member_id, reason = assigned[d.code]
        if member_id != d.suggested_assignee_id or reason != d.assign_reason:
            updated += 1
        was_following = d.assignee_id == d.suggested_assignee_id and d.assignee_id is not None
        d.suggested_assignee_id, d.assign_reason = member_id, reason
        if was_following:
            d.assignee_id = member_id
    return updated
