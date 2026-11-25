"""專案脈絡助理：依任務規格與專案文件回答，並建議可加入 Living Prompt 的指令"""

from uuid import uuid4

from app.ai import audit
from app.ai.context import DocSnippet
from app.ai.llm import LlmClient
from app.ai.prompts import load_prompt
from app.ai.schemas import LlmChat
from app.core.errors import ApiError
from app.schemas.collab import ChatMessage
from app.schemas.task import Task
from app.services._render import block, task_text
from app.services._secrets import find_secrets, mask
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
    fake_sources = [s for s in dict.fromkeys(result.sources) if s not in known]
    if fake_sources:
        audit.note("drop_unknown_sources", f"捨棄沒有提供過的文件名稱：{fake_sources}", dropped=fake_sources)
    # [v0.3.2 修改] 回答中若仍出現金鑰值，由程式遮蔽（C15，R7）
    secrets = find_secrets(d.text for d in docs)
    answer = mask(result.answer.strip(), secrets)
    addition = mask((result.prompt_addition or "").strip(), secrets) or None
    if answer != result.answer.strip() or addition != ((result.prompt_addition or "").strip() or None):
        audit.note("mask_secret", "回答中出現金鑰值，已遮蔽")
    return ChatMessage(
        id=f"m-{uuid4().hex[:8]}",
        role="assistant",
        text=answer,
        sources=sources or None,
        prompt_addition=addition,
    )
