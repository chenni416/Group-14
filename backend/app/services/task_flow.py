"""任務層級的 AI 流程：執行計畫建議、驗收檢查、專案脈絡助理與 Living Prompt（資料層 ↔ AI 引擎）"""

from datetime import date

from app.ai.llm import LlmClient
from app.core.errors import ApiError
from app.repo import MemoryStore
from app.repo.memory import PromptThread
from app.schemas.acceptance import AcceptanceCheck
from app.schemas.collab import ChatMessage, ExecutionPlan, PromptState
from app.schemas.member import Member
from app.schemas.task import Task
from app.services import acceptance_ai, chat_ai, execution_ai


def _owner_only(task: Task, member: Member, action: str) -> None:
    if member.id != task.assignee_id:
        raise ApiError(f"只有任務負責人可以{action}", status=403, code="FORBIDDEN")


# ---------- G3：執行計畫 ----------


def suggest_execution_plan(
    store: MemoryStore, task_id: str, member: Member, llm: LlmClient, today: date
) -> ExecutionPlan:
    task = store.find_task(task_id)
    if member.id != task.assignee_id and member.role != "Leader":
        raise ApiError("只有任務負責人或 Leader 可以產生執行計畫", status=403, code="FORBIDDEN")
    existing = store.plans.get(task_id)
    if existing and existing.confirmed_at:
        raise ApiError("執行計畫已確認，不能重新產生", status=409, code="CONFLICT")

    sprint = store.find_sprint(task.sprint_id)
    end = date.fromisoformat(sprint.end_date)
    start = min(max(today, date.fromisoformat(sprint.start_date)), end)
    deps = [store.tasks[d.id] for d in task.depends_on if d.id in store.tasks]
    plan = execution_ai.suggest_plan(task, deps, store.docs, start, end, llm)
    store.plans[task_id] = plan
    return plan


# ---------- G5：驗收檢查 ----------


def check_acceptance(store: MemoryStore, task_id: str, llm: LlmClient) -> AcceptanceCheck:
    return acceptance_ai.check_delivery(store.find_task(task_id), llm)


# ---------- Living Prompt 與專案脈絡助理（僅任務負責人） ----------


def build_prompt(task: Task, additions: list[str]) -> list[str]:
    """Living Prompt：任務規格 + 對話中累積的釐清結論"""
    lines = [
        f"你正在協助完成任務 {task.id}：{task.title}",
        f"任務目標：{task.description}",
        f"工作範圍：{task.scope}",
        "驗收條件：",
        *[f"{i}. {a}" for i, a in enumerate(task.acceptance_criteria, start=1)],
    ]
    if additions:
        lines += ["已釐清的決定與限制：", *[f"- {a}" for a in additions]]
    return lines


def _prompt_state(task: Task, thread: PromptThread) -> PromptState:
    versions = [build_prompt(task, adds) for adds in thread.clarifications]
    return PromptState(versions=versions, current=thread.cursor)


def get_prompt(store: MemoryStore, task_id: str, member: Member) -> PromptState:
    task = store.find_task(task_id)
    _owner_only(task, member, "查看 Prompt")
    return _prompt_state(task, store.thread(task_id))


def set_prompt_version(store: MemoryStore, task_id: str, version: int, member: Member) -> PromptState:
    task = store.find_task(task_id)
    _owner_only(task, member, "切換 Prompt 版本")
    thread = store.thread(task_id)
    thread.cursor = max(0, min(len(thread.clarifications) - 1, version))
    return _prompt_state(task, thread)


def _ensure_greeting(store: MemoryStore, task: Task) -> PromptThread:
    thread = store.thread(task.id)
    if not thread.chat:
        thread.chat.append(
            ChatMessage(
                id="greeting",
                role="assistant",
                text=(
                    f"我已讀取 {task.id} 的規格與 {len(store.docs)} 份專案文件。"
                    "有任何需要釐清的地方都可以直接問，不用重打背景；我會把結論更新到左側的 Prompt。"
                ),
            )
        )
    return thread


def get_chat(store: MemoryStore, task_id: str, member: Member) -> list[ChatMessage]:
    task = store.find_task(task_id)
    _owner_only(task, member, "查看對話紀錄")
    return _ensure_greeting(store, task).chat


def ask(store: MemoryStore, task_id: str, question: str, member: Member, llm: LlmClient) -> ChatMessage:
    task = store.find_task(task_id)
    _owner_only(task, member, "使用專案脈絡助理")
    thread = _ensure_greeting(store, task)
    reply = chat_ai.ask(task, question, store.docs, thread.chat, llm)  # 失敗時不會留下半截對話
    thread.chat.append(ChatMessage(id=f"m-{len(thread.chat)}-u", role="user", text=question.strip()))
    current = thread.clarifications[thread.cursor]
    if reply.prompt_addition and reply.prompt_addition not in current:
        # 從目前版本往後長出新版本（捨棄被還原版本之後的舊版本）
        thread.clarifications = [*thread.clarifications[: thread.cursor + 1], [*current, reply.prompt_addition]]
        thread.cursor = len(thread.clarifications) - 1
    reply.prompt_version = thread.cursor + 1
    thread.chat.append(reply)
    return reply
