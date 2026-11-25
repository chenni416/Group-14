"""提供給模型參考的專案文件片段。

目前文件全文直接帶入 prompt（量小，不做向量檢索）。之後要加入 RAG，檢索結果也以 `DocSnippet` 傳給各 AI 服務
（`services/chat_ai.py`、`services/execution_ai.py`），只需要在呼叫端換掉取得片段的方式。
"""

from dataclasses import dataclass


@dataclass
class DocSnippet:
    """提供給模型參考的專案文件片段"""

    name: str
    text: str
