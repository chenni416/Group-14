"""專案脈絡助理：依任務規格與專案文件回答，並建議可加入 Living Prompt 的指令"""

from uuid import uuid4

from app.ai.context import DocSnippet
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmChat
from app.core.errors import ApiError
from app.schemas.collab import ChatMessage
from app.schemas.task import Task
from app.services._render import block, task_text
from app.services.execution_ai import docs_text

HISTORY_TURNS = 6


def ask(task: Task, question: str, docs: list[DocSnippet], history: list[ChatMessage], llm: LlmClient) -> ChatMessage:
    q = question.strip()
    if not q:
        raise ApiError("請輸入問題")
    recent = "\n".join(f"{'成員' if m.role == 'user' else '助理'}：{m.text}" for m in history[-HISTORY_TURNS * 2 :])
    result = llm.generate_json(
        system=load_prompt("context_chat"),
        user=block("task", task_text(task))
        + "\n\n"
        + block("project_docs", docs_text(docs))
        + "\n\n"
        + block("conversation_history", recent)
        + "\n\n"
        + block("question", q),
        schema=LlmChat,
    )
    known = {d.name for d in docs}
    sources = [s for s in dict.fromkeys(result.sources) if s in known]  # 只保留真的提供過的文件
    addition = (result.prompt_addition or "").strip() or None
    return ChatMessage(
        id=f"m-{uuid4().hex[:8]}",
        role="assistant",
        text=result.answer.strip(),
        sources=sources or None,
        prompt_addition=addition,
    )
