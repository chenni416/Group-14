"""登入成員：第一次登入建立、之後同步 GitHub 資料、修改顯示名稱（規格見 docs/github.md 3.1）"""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.models import Member as MemberRow
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def me(token: str) -> dict:
    res = client.get("/api/me", headers=bearer(token))
    assert res.status_code == 200, res.json()
    return res.json()


def count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(MemberRow)) or 0


def test_first_login_creates_member(db: Session) -> None:
    body = me(make_token())
    row = db.scalar(select(MemberRow))
    assert count(db) == 1
    assert body["id"] == str(row.id)
    # 顯示名稱預設為 GitHub 帳號名稱，不是 GitHub 上的全名
    assert body["name"] == "octocat"
    assert body["githubLogin"] == "octocat"
    assert body["displayName"] is None
    assert body["avatarUrl"] == "https://avatars.githubusercontent.com/u/1001"
    assert str(row.auth_user_id) == "5f0c6a8e-1d2b-4c3a-9e8f-000000000123"
    assert row.github_id == 1001
    assert row.last_login_at is not None


def test_login_again_reuses_member(db: Session) -> None:
    first = me(make_token())
    second = me(make_token())
    assert count(db) == 1
    assert first["id"] == second["id"]


def test_github_changes_are_synced(db: Session) -> None:
    member_id = me(make_token())["id"]
    body = me(
        make_token(
            login="octocat-renamed", avatar_url="https://avatars.githubusercontent.com/u/9", email="new@example.com"
        )
    )
    assert body["id"] == member_id
    assert (body["githubLogin"], body["name"], body["avatarUrl"], body["email"]) == (
        "octocat-renamed",
        "octocat-renamed",
        "https://avatars.githubusercontent.com/u/9",
        "new@example.com",
    )


def test_same_github_account_with_new_supabase_user(db: Session) -> None:
    """Supabase 帳號重建（sub 改變）時，以 GitHub id 找回原本的成員"""
    old_sub, new_sub = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
    member_id = me(make_token(sub=old_sub))["id"]
    assert me(make_token(sub=new_sub))["id"] == member_id
    assert count(db) == 1
    assert str(db.scalar(select(MemberRow.auth_user_id))) == new_sub


def test_display_name_overrides_and_survives_login(db: Session) -> None:
    token = make_token()
    me(token)
    res = client.patch("/api/me", headers=bearer(token), json={"displayName": "  阿凱  "})
    assert res.status_code == 200
    assert (res.json()["name"], res.json()["displayName"]) == ("阿凱", "阿凱")
    # 再次登入（GitHub 資料同步）不會覆蓋自訂名稱
    assert me(make_token(login="octocat-renamed"))["name"] == "阿凱"


def test_blank_display_name_resets_to_github_login(db: Session) -> None:
    token = make_token()
    me(token)
    client.patch("/api/me", headers=bearer(token), json={"displayName": "阿凱"})
    res = client.patch("/api/me", headers=bearer(token), json={"displayName": "   "})
    assert (res.json()["name"], res.json()["displayName"]) == ("octocat", None)


def test_display_name_too_long(db: Session) -> None:
    token = make_token()
    me(token)
    res = client.patch("/api/me", headers=bearer(token), json={"displayName": "名" * 51})
    assert (res.status_code, res.json()["code"]) == (422, "VALIDATION_ERROR")


def test_non_github_login_is_rejected(db: Session) -> None:
    res = client.get("/api/me", headers=bearer(make_token(github_id=None)))
    assert (res.status_code, res.json()["code"]) == (403, "GITHUB_REQUIRED")
    assert count(db) == 0


def test_demo_member_cannot_update_display_name(db: Session) -> None:
    res = client.patch("/api/me", headers={"X-Demo-User": "m1"}, json={"displayName": "測試"})
    assert (res.status_code, res.json()["code"]) == (400, "NOT_A_GITHUB_MEMBER")
