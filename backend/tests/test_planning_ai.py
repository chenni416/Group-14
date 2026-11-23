"""AI 規劃功能：用假的 LLM 驗證串接邏輯，不呼叫 OpenAI"""

import pytest
from fastapi.testclient import TestClient

from app.ai.llm import get_llm
from app.ai.schemas import LlmClarify, LlmDependency, LlmStory, LlmStoryDraft
from app.main import app

LEADER = {"X-Demo-User": "m1"}  # 開發用假登入：Leader（main 的登入驗證不再預設身分）

MINUTES = "討論對話功能\n需要保留對話紀錄\n\n手機版也要能用"


class FakeLlm:
    def __init__(self, result: LlmStoryDraft) -> None:
        self.result = result
        self.calls: list[dict] = []

    def generate_json(self, *, system: str, user: str, schema):
        self.calls.append({"system": system, "user": user, "schema": schema})
        return self.result

    def generate_text(self, *, system: str, user: str) -> str:
        return "ok"


def _story(**over) -> LlmStory:
    base = dict(
        title="任務內 AI 對話",
        user_story="身為成員，我想要在任務內提問，以便釐清規格。",
        story_points=5,
        scope=["對話 API", "Split View"],
        rationale="同一個使用情境",
        source_lines=[1, 2],
        depends_on=[],
        clarify=[],
    )
    return LlmStory(**{**base, **over})


@pytest.fixture
def client():
    yield TestClient(app, headers=LEADER)
    app.dependency_overrides.clear()


def _use(fake: FakeLlm) -> None:
    app.dependency_overrides[get_llm] = lambda: fake


def test_generate_draft_maps_llm_output(client) -> None:
    fake = FakeLlm(
        LlmStoryDraft(
            stories=[
                _story(
                    clarify=[
                        LlmClarify(
                            kind="question", text="保留多久？", options=["一個月", "永久"], effect="保存：{answer}"
                        ),
                        LlmClarify(kind="suggestion", text="先做 API", options=[], effect="標為前置"),
                    ]
                ),
                _story(title="手機版", source_lines=[4], depends_on=[LlmDependency(story_no=1, reason="共用元件")]),
            ]
        )
    )
    _use(fake)

    res = client.post("/api/planning/drafts", json={"goal": "上線對話", "minutes": MINUTES})

    assert res.status_code == 200
    body = res.json()
    assert body["tasks"] == []
    first, second = body["stories"]
    assert (first["id"], first["no"], first["code"]) == ("st-1", 1, "S3-1")  # Sprint 3 是種子資料裡規劃中的 Sprint
    assert first["storyPoints"] == 5
    assert first["sources"] == [{"line": 1, "text": "討論對話功能"}, {"line": 2, "text": "需要保留對話紀錄"}]
    assert first["clarify"][0] == {
        "id": "cq-1-1",
        "kind": "question",
        "text": "保留多久？",
        "options": ["一個月", "永久"],
        "effect": "保存：{answer}",
        "answer": None,
        "decision": None,
    }
    assert first["clarify"][1]["options"] is None  # suggestion 不帶選項
    assert second["dependsOn"] == [{"id": "st-1", "reason": "共用元件"}]
    # 會議紀錄帶行號、並放在參考資料區塊
    user = fake.calls[0]["user"]
    assert "<meeting_minutes>" in user and "2  需要保留對話紀錄" in user


def test_generate_draft_drops_invented_lines_and_bad_dependencies(client) -> None:
    _use(
        FakeLlm(
            LlmStoryDraft(
                stories=[
                    _story(
                        source_lines=[2, 2, 3, 99, 0],  # 重複、空白行、超出範圍
                        depends_on=[
                            LlmDependency(story_no=1, reason="自己"),
                            LlmDependency(story_no=7, reason="不存在"),
                        ],
                    )
                ]
            )
        )
    )

    story = client.post("/api/planning/drafts", json={"goal": "", "minutes": MINUTES}).json()["stories"][0]

    assert [s["line"] for s in story["sources"]] == [2]
    assert story["dependsOn"] == []
    assert story["clarify"] is None


def test_generate_draft_rejects_blank_minutes(client) -> None:
    fake = FakeLlm(LlmStoryDraft(stories=[]))
    _use(fake)

    res = client.post("/api/planning/drafts", json={"goal": "x", "minutes": "   "})

    assert res.status_code == 400
    assert fake.calls == []  # 不浪費 LLM 呼叫


def test_generate_draft_empty_result_is_error(client) -> None:
    _use(FakeLlm(LlmStoryDraft(stories=[])))

    res = client.post("/api/planning/drafts", json={"goal": "x", "minutes": MINUTES})

    assert res.status_code == 422
    assert res.json()["code"] == "AI_EMPTY_RESULT"


def test_missing_api_key_returns_503(client, monkeypatch) -> None:
    from app.core import config

    monkeypatch.setenv("OPENAI_API_KEY", "")
    config.get_settings.cache_clear()
    get_llm.cache_clear()
    try:
        res = client.post("/api/planning/drafts", json={"goal": "x", "minutes": MINUTES})
    finally:
        config.get_settings.cache_clear()
    assert res.status_code == 503
    assert res.json()["code"] == "AI_NOT_CONFIGURED"
