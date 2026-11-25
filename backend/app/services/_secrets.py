"""[v0.3.2 修改] 遮蔽專案文件中的金鑰值（prompt 測試 C15，EVAL_LOG R7）

提示詞已經規定不要輸出金鑰，但真實模型仍偶爾把 .env 範例的值原樣寫進回答。
所以由程式處理：送給模型前先把值換成佔位字，回答中若仍出現也再遮蔽一次。
這同時避免把團隊的金鑰送到外部 API。
"""

import re
from collections.abc import Iterable

PLACEHOLDER = "<你的值>"

# 名稱含 KEY／SECRET／TOKEN／PASSWORD 的環境變數設定行，例如 GITHUB_WEBHOOK_SECRET=whsec_xxx
_ENV_LINE = re.compile(
    r"^(\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*[=:]\s*)(['\"]?)([^\s'\"#]+)\2",
    re.MULTILINE,
)
# 常見金鑰格式（不論出現在哪裡）：OpenAI、GitHub webhook／token、JWT
_KNOWN_FORMATS = re.compile(
    r"\b(?:sk-[A-Za-z0-9_-]{8,}|whsec_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{10,}"
    r"|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+)"
)


def find_secrets(texts: Iterable[str]) -> set[str]:
    """找出文件中出現的金鑰值（已經是佔位字的不算）"""
    found: set[str] = set()
    for text in texts:
        for m in _ENV_LINE.finditer(text):
            value = m.group(3)
            if not value.startswith("<") and value.lower() not in {"changeme", "xxx", "your-key"}:
                found.add(value)
        found.update(_KNOWN_FORMATS.findall(text))
    return found


def mask(text: str, secrets: Iterable[str] = ()) -> str:
    """把已知的金鑰值與常見金鑰格式換成佔位字"""
    for value in sorted(set(secrets), key=len, reverse=True):
        text = text.replace(value, PLACEHOLDER)
    return _KNOWN_FORMATS.sub(PLACEHOLDER, text)
