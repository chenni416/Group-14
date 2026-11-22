"""AI 稽核紀錄：每次呼叫模型都要留下提示詞、token、原始回傳、程式的修正與回給前端的內容"""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.ai import audit, schemas
from app.ai.llm import OpenAILlm, get_llm
from app.main import app

LEADER = {"X-Demo-User": "m1"}  # main 的登入驗證不再預設身分，測試以開發用假登入的 Leader 呼叫
MINUTES = "討論對話功能\n需要保留對話紀錄\n\n手機版也要能用"


def _stub_openai(parsed: schemas.LlmStoryDraft) -> SimpleNamespace:
    """像真的 OpenAI SDK 一樣回傳 content（原始 JSON）、usage 與 model"""

    def parse(**_kwargs):
        message = SimpleNamespace(refusal=None, parsed=parsed, content=parsed.model_dump_json())
        usage = SimpleNamespace(prompt_tokens=120, completion_tokens=45, total_tokens=165)
        return SimpleNamespace(
            model="gpt-4.1-2025-04-14",
            usage=usage,
            choices=[SimpleNamespace(message=message, finish_reason="stop")],
        )

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))


def _story(**over) -> schemas.LlmStory:
    base = dict(
        title="任務內 AI 對話",
        user_story="身為成員，我想要在任務內提問，以便釐清規格。",
        story_points=5,
        scope=["對話 API"],
        rationale="同一個使用情境",
        source_lines=[1, 2],
        depends_on=[],
        clarify=[],
    )
    return schemas.LlmStory(**{**base, **over})


@pytest.fixture
def log_file(tmp_path, monkeypatch):
    path = tmp_path / "ai-calls.jsonl"
    monkeypatch.setattr(audit, "_log_path", lambda: path)
    yield path
    app.dependency_overrides.clear()


def _records(path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_one_record_per_request_with_everything(log_file) -> None:
    draft = schemas.LlmStoryDraft(stories=[_story(source_lines=[2, 99])])  # 99 是編造的行號
    llm = OpenAILlm(_stub_openai(draft), "gpt-4.1", temperature=0.2)
    app.dependency_overrides[get_llm] = lambda: llm

    res = TestClient(app, headers=LEADER).post("/api/planning/drafts", json={"goal": "上線對話", "minutes": MINUTES})

    assert res.status_code == 200
    (rec,) = _records(log_file)
    # 請求
    assert rec["request"]["method"] == "POST" and rec["request"]["path"] == "/api/planning/drafts"
    assert rec["request"]["body"] == {"goal": "上線對話", "minutes": MINUTES}
    # 模型呼叫：提示詞、模型、token、原始回傳
    (call,) = rec["llm_calls"]
    assert call["model"] == "gpt-4.1-2025-04-14" and call["temperature"] == 0.2
    assert call["schema"] == "LlmStoryDraft"
    assert "<meeting_minutes>" in call["user_message"] and call["system_prompt"]
    assert (call["prompt_tokens"], call["completion_tokens"], call["total_tokens"]) == (120, 45, 165)
    assert json.loads(call["raw_output"])["stories"][0]["title"] == "任務內 AI 對話"
    assert rec["totals"] == {"calls": 1, "prompt_tokens": 120, "completion_tokens": 45, "total_tokens": 165}
    # 程式的修正
    (adj,) = rec["adjustments"]
    assert adj["kind"] == "drop_source_lines" and adj["dropped"] == [99] and adj["after_call"] == 1
    # 回給前端的內容與 API 實際回應一致
    assert rec["response"]["status"] == 200
    assert rec["response"]["body"] == res.json()


def test_failed_openai_call_is_recorded_with_error(log_file) -> None:
    import httpx
    import openai

    def parse(**_kwargs):
        raise openai.APITimeoutError(request=httpx.Request("POST", "https://api.openai.com"))

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(parse=parse)))
    app.dependency_overrides[get_llm] = lambda: OpenAILlm(client, "gpt-4.1")

    res = TestClient(app, headers=LEADER).post("/api/planning/drafts", json={"goal": "", "minutes": MINUTES})

    assert res.status_code == 504
    (rec,) = _records(log_file)
    assert "APITimeoutError" in rec["llm_calls"][0]["error"]
    assert rec["response"]["status"] == 504 and rec["response"]["body"]["code"] == "AI_TIMEOUT"


def test_requests_without_llm_call_are_not_recorded(log_file) -> None:
    TestClient(app, headers=LEADER).get("/api/health")
    TestClient(app, headers=LEADER).post("/api/planning/drafts", json={"goal": "", "minutes": "  "})  # 400，沒呼叫模型
    assert not log_file.exists()


def test_empty_log_path_disables_recording(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(audit, "_log_path", lambda: None)
    draft = schemas.LlmStoryDraft(stories=[_story()])
    app.dependency_overrides[get_llm] = lambda: OpenAILlm(_stub_openai(draft), "gpt-4.1")
    try:
        assert (
            TestClient(app, headers=LEADER)
            .post("/api/planning/drafts", json={"goal": "", "minutes": MINUTES})
            .status_code
            == 200
        )
    finally:
        app.dependency_overrides.clear()
    assert list(tmp_path.iterdir()) == []


def test_dev_endpoint_returns_recent_newest_first(log_file) -> None:
    draft = schemas.LlmStoryDraft(stories=[_story()])
    app.dependency_overrides[get_llm] = lambda: OpenAILlm(_stub_openai(draft), "gpt-4.1")
    client = TestClient(app, headers=LEADER)
    for goal in ("第一次", "第二次"):
        client.post("/api/planning/drafts", json={"goal": goal, "minutes": MINUTES})

    logs = client.get("/api/dev/ai-logs?limit=5").json()

    assert [r["request"]["body"]["goal"] for r in logs] == ["第二次", "第一次"]


def test_readable_html_view(log_file) -> None:
    draft = schemas.LlmStoryDraft(stories=[_story(source_lines=[2, 99])])
    app.dependency_overrides[get_llm] = lambda: OpenAILlm(_stub_openai(draft), "gpt-4.1")
    client = TestClient(app, headers=LEADER)
    client.post("/api/planning/drafts", json={"goal": "<b>上線對話</b>", "minutes": MINUTES})

    res = client.get("/api/dev/ai-logs/view")

    assert res.status_code == 200 and res.headers["content-type"].startswith("text/html")
    html = res.text
    assert "POST /api/planning/drafts" in html and "gpt-4.1-2025-04-14" in html and "165" in html
    assert "捨棄編造的來源行號" in html and "99" in html  # 程式修正以中文說明
    assert "&lt;b&gt;上線對話&lt;/b&gt;" in html and "<b>上線對話</b>" not in html  # 內容已跳脫，不會被當成 HTML


def test_readable_html_view_when_empty(log_file) -> None:
    assert "還沒有紀錄" in TestClient(app, headers=LEADER).get("/api/dev/ai-logs/view").text
