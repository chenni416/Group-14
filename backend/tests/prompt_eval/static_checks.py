"""不呼叫 API 的提示詞檢查：每次改提示詞都可以先跑，CI 也會跑（tests/test_prompt_static.py）"""

import re

from app.ai import prompts as prompt_module
from app.ai import schemas as s
from app.ai.prompts import load_prompt

from .cases import CASES
from .harness import Check, DryRunLlm, DryRunStop, ok

# 每個提示詞對應的模型輸出格式：提示詞必須提到其中每一個欄位名稱
SCHEMA_FIELDS: dict[str, list[type]] = {
    "analyze_minutes": [s.LlmStory, s.LlmClarify, s.LlmDependency],
    "clarify_questions": [s.LlmQuestion],
    "generate_tasks": [s.LlmTask, s.LlmTaskDep],
    "task_dependencies": [s.LlmTaskDependency],
    "assign": [s.LlmAssignment],
    "reassign": [s.LlmReassign],
    "defer_tasks": [s.LlmDeferral],
    "context_chat": [s.LlmChat],
}


def render(case) -> tuple[str, str, str]:
    """只組出提示詞，不呼叫 API。回傳 (輸出格式名稱, system, user)"""
    llm = DryRunLlm()
    try:
        case.run(llm)
    except DryRunStop:
        pass
    call = llm.calls[0]
    return call.schema, call.system, call.user


def static_checks() -> list[tuple[str, Check]]:
    out: list[tuple[str, Check]] = []
    safety = (prompt_module._DIR / "_safety.md").read_text(encoding="utf-8").strip()
    for name, classes in SCHEMA_FIELDS.items():
        prompt = load_prompt(name)
        missing = [f for c in classes for f in c.model_fields if f not in prompt]
        out.append((name, ok("提示詞提到所有輸出欄位", not missing, f"缺少：{missing}")))
        out.append((name, ok("已附加共用規則 _safety.md", prompt.rstrip().endswith(safety))))
    for case in CASES:
        try:
            _schema, system, user = render(case)
        except Exception as exc:  # noqa: BLE001 - 測試工具：任何錯誤都要回報
            out.append((case.id, Check("可以組出提示詞", False, repr(exc))))
            continue
        tags = sorted(set(re.findall(r"^<([a-z_]+)>$", user, flags=re.M)))
        missing_tags = [t for t in tags if f"<{t}>" not in system]
        out.append((case.id, ok(f"提示詞說明了輸入區塊 {tags}", not missing_tags, f"提示詞沒有說明：{missing_tags}")))
    return out
