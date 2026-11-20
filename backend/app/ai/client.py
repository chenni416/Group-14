"""Anthropic API 客戶端。所有 LLM 呼叫都經過這裡，方便統一記錄用量與錯誤"""

from functools import lru_cache

import anthropic

from app.core.config import get_settings


@lru_cache
def get_client() -> anthropic.Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise RuntimeError("尚未設定 ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def default_model() -> str:
    return get_settings().anthropic_model
