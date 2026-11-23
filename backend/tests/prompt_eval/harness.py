"""Prompt 測試集的共用工具：記錄模型輸入輸出、只輸出提示詞不呼叫 API、檢查項目的資料結構"""

import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel

from app.ai.llm import LlmClient

CaseType = Literal["typical", "edge", "adversarial"]


@dataclass
class Call:
    """一次模型呼叫的紀錄"""

    schema: str
    system: str
    user: str
    output: Any = None
    latency_ms: int = 0


class RecordingLlm:
    """包住真正的 LlmClient，記錄每次呼叫的輸入與模型「原始」輸出（程式校正之前）"""

    def __init__(self, inner: LlmClient) -> None:
        self.inner = inner
        self.calls: list[Call] = []

    def generate_json(self, *, system: str, user: str, schema):
        start = time.perf_counter()
        result = self.inner.generate_json(system=system, user=user, schema=schema)
        self.calls.append(Call(schema.__name__, system, user, result, int((time.perf_counter() - start) * 1000)))
        return result

    def generate_text(self, *, system: str, user: str) -> str:
        start = time.perf_counter()
        result = self.inner.generate_text(system=system, user=user)
        self.calls.append(Call("text", system, user, result, int((time.perf_counter() - start) * 1000)))
        return result

    def raw(self, schema: type[BaseModel] | str):
        """取得某個輸出格式的第一次原始輸出"""
        name = schema if isinstance(schema, str) else schema.__name__
        return next(c.output for c in self.calls if c.schema == name)


class DryRunStop(Exception):
    """只輸出提示詞、不呼叫 API 時，用來中止流程"""


class DryRunLlm:
    """不呼叫 API：記錄第一次呼叫的 system / user 後中止，用於檢查提示詞與貼到網頁版測試"""

    def __init__(self) -> None:
        self.calls: list[Call] = []

    def generate_json(self, *, system: str, user: str, schema):
        self.calls.append(Call(schema.__name__, system, user))
        raise DryRunStop

    def generate_text(self, *, system: str, user: str) -> str:
        self.calls.append(Call("text", system, user))
        raise DryRunStop


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class Case:
    id: str
    agent: str
    """對應 CLAUDE.md 的 Agent 1–4"""
    prompt: str
    """主要測試的提示詞檔名（不含 .md）"""
    type: CaseType
    title: str
    expect: str
    """預期行為（一句話，寫進測試紀錄）"""
    run: Callable[[LlmClient], Any]
    """執行服務函式，回傳程式校正後的結果"""
    check: Callable[[RecordingLlm, Any], list[Check]]
    """自動檢查：可同時看模型原始輸出（rec.raw）與校正後結果"""
    review: list[str] = field(default_factory=list)
    """需要人工判斷的項目（0 不符合／1 部分符合／2 符合）"""


# ---------- 檢查用小工具 ----------


def ok(name: str, cond: bool, detail: Any = "") -> Check:
    return Check(name, bool(cond), "" if cond else str(detail))


def contains_any(text: str, words: list[str]) -> list[str]:
    return [w for w in words if w in text]


def sentences(text: str) -> int:
    return len([s for s in re.split(r"[。！？!?\n]+", text) if s.strip()])
