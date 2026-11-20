"""Prompt 與對話 API，對應前端 contracts.ts 的 studio。

前端 mock 實作（規則可直接當規格移植）：
- frontend/src/services/mock/tasks.ts
- frontend/src/mocks/handlers/prompt.ts
- frontend/src/mocks/handlers/chat.ts

目前只定義路徑與輸入輸出格式，呼叫時回傳 501。實作時把 raise 換成 app/services 裡的商業邏輯。
"""

from fastapi import APIRouter

from app.ai.llm import Llm
from app.core.auth import CurrentMember
from app.repo import Store
from app.schemas.collab import AskBody, ChatMessage, PromptState, PromptVersionBody
from app.services import task_flow

router = APIRouter(tags=["Prompt 與對話"])


@router.get(
    "/tasks/{task_id}/prompt",
    operation_id="studio.getPrompt",
    summary="Living Prompt（僅任務負責人）",
    response_model=PromptState,
)
async def get_prompt(task_id: str, store: Store, me: CurrentMember) -> PromptState:
    return task_flow.get_prompt(store, task_id, me)


@router.put(
    "/tasks/{task_id}/prompt/current",
    operation_id="studio.setPromptVersion",
    summary="切換 Prompt 版本（僅任務負責人）",
    response_model=PromptState,
)
async def set_prompt_version(task_id: str, body: PromptVersionBody, store: Store, me: CurrentMember) -> PromptState:
    return task_flow.set_prompt_version(store, task_id, body.version, me)


@router.get(
    "/tasks/{task_id}/chat",
    operation_id="studio.getChat",
    summary="專案脈絡助理對話紀錄（僅任務負責人）",
    response_model=list[ChatMessage],
)
async def get_chat(task_id: str, store: Store, me: CurrentMember) -> list[ChatMessage]:
    return task_flow.get_chat(store, task_id, me)


@router.post(
    "/tasks/{task_id}/chat",
    operation_id="studio.ask",
    summary="詢問專案脈絡助理（僅任務負責人）",
    response_model=ChatMessage,
)
def ask(task_id: str, body: AskBody, store: Store, me: CurrentMember, llm: Llm) -> ChatMessage:
    return task_flow.ask(store, task_id, body.question, me, llm)
