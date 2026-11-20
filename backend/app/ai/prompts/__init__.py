"""讀取 prompts/*.md；一個 AI 功能一個檔案，共用的安全條款（_safety.md）會自動附加在後面"""

from functools import lru_cache
from pathlib import Path

_DIR = Path(__file__).parent


@lru_cache
def load_prompt(name: str) -> str:
    body = (_DIR / f"{name}.md").read_text(encoding="utf-8").rstrip()
    safety = (_DIR / "_safety.md").read_text(encoding="utf-8")
    return f"{body}\n{safety}"
