"""Story → Task 拆解、Story 微調對話、容量延後與重新平衡（皆為草稿，不寫入資料庫）"""

import re

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


def task_code(sprint_id: int, story_no: int, no: int) -> str:
    """與前端 lib/planning.ts 的 taskCode 一致：S-{Sprint}{Story 序號}{Task 序號}"""
    return f"S-{sprint_id}{story_no}{no}"


def _stories_text(stories: list[StoryDraft]) -> str:
    return "\n\n".join(
        f"Story no={s.no}｜{s.title}（{s.story_points} 點）\n"
        f"  使用情境：{s.user_story}\n"
        f"  範疇：{'；'.join(s.scope) or '（未列）'}"
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
    deps.update(kept)


def generate_tasks(body: GenerateTasksInput, members: list[Member], llm: LlmClient) -> list[TaskDraft]:
    stories = {s.no: s for s in body.stories if not s.deferred}
    if not stories:
        raise ApiError("請先建立至少一個 Story（已延後的 Story 不會拆解）")

    result = llm.generate_json(
        system=load_prompt("generate_tasks"),
        user=block("stories", _stories_text(list(stories.values()))),
        schema=LlmTaskDraft,
    )

    counters: dict[int, int] = {}
    keyed: dict[tuple[int, int], str] = {}  # (story_no, task_no) → draft id
    drafts: list[TaskDraft] = []
    raws = [t for t in result.tasks if t.story_no in stories]
    for raw in raws:
        story = stories[raw.story_no]
        no = counters[story.no] = counters.get(story.no, 0) + 1
        draft_id = f"{story.id}-tk-{no}"
        keyed[(story.no, no)] = draft_id
        drafts.append(
            TaskDraft(
                id=draft_id,
                story_id=story.id,
                no=no,
                code=task_code(body.sprint_id, story.no, no),
                title=raw.title.strip(),
                domain=raw.domain,
                branch_prefix=raw.branch_prefix,
                branch_slug=_slug(raw.branch_slug, no),
                story_points=min(max(raw.story_points, 1), 13),
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
        raise ApiError("AI 沒有拆出任何 Task，請確認 Story 的範疇後再試", status=422, code="AI_EMPTY_RESULT")

    # 依賴：只保留指向存在的其他 Task 的項目，再去掉循環
    deps: dict[str, list[DraftDependency]] = {}
    for raw, draft in zip(raws, drafts, strict=True):
        deps[draft.id] = [
            DraftDependency(id=keyed[(d.story_no, d.task_no)], reason=d.reason)
            for d in raw.depends_on
            if (d.story_no, d.task_no) in keyed and keyed[(d.story_no, d.task_no)] != draft.id
        ]
    _drop_cycles(deps)
    for draft in drafts:
        draft.depends_on = deps[draft.id]

    if members:
        assigned = suggest_assignments(drafts, members, llm)
        for draft in drafts:
            if draft.code in assigned:
                draft.suggested_assignee_id, draft.assign_reason = assigned[draft.code]
            else:
                draft.assign_reason = "AI 沒有給出合適的人選，請自行指派。"
    return drafts


def story_assistant_reply(body: StoryAssistantBody, goal: str, stories: list[StoryDraft], llm: LlmClient) -> str:
    question = body.question.strip()
    if not question:
        raise ApiError("請輸入問題")
    focus = body.story_title or "（未指定，指整體切分）"
    user = "\n\n".join(
        [
            block("sprint_goal", goal),
            block("stories", _stories_text(stories)),
            block("focus_story", focus),
            block("question", question),
        ]
    )
    return llm.generate_text(system=load_prompt("story_assistant"), user=user).strip()


def defer_suggested(drafts: list[TaskDraft], goal: str, members: list[Member], llm: LlmClient) -> list[str]:
    """依容量建議延後的 Task id（含依賴它們的 Task）。未超過容量回傳空陣列"""
    capacity = sum(m.capacity for m in members)
    active = [d for d in drafts if not d.deferred]
    total = sum(d.story_points for d in active)
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
        + block("capacity", f"團隊 capacity {capacity} 點；目前草稿共 {total} 點，超出 {total - capacity} 點")
        + "\n\n"
        + block("tasks", lines),
        schema=LlmDeferral,
    )
    ids = {d.id for d in active}
    deferred = {i for i in result.task_ids if i in ids}
    # 依賴被延後任務的 Task 也必須一起延後，否則會卡住
    changed = True
    while changed:
        changed = False
        for d in active:
            if d.id not in deferred and any(x.id in deferred for x in d.depends_on):
                deferred.add(d.id)
                changed = True
    return [d.id for d in active if d.id in deferred]


def rebalance(
    drafts: list[TaskDraft], members: list[Member], llm: LlmClient, locked: frozenset[str] = frozenset()
) -> int:
    """重新平衡指派，只調整 Leader 沒動過的草稿（沒有指派，或指派等於 AI 原本的建議，且不在 locked 內）。回傳調整數"""
    if not members:
        raise ApiError("尚無成員資料，無法重新平衡", status=409, code="NO_MEMBERS")
    movable = [
        d
        for d in drafts
        if not d.deferred and d.id not in locked and (d.assignee_id is None or d.assignee_id == d.suggested_assignee_id)
    ]
    movable_ids = {d.id for d in movable}
    locked_loads: dict[str, int] = {}
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
