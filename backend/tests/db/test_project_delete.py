"""刪除專案、把成員移出專案（Leader 限定，刪除專案需要再次輸入名稱）"""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.main import app
from app.models import Document, Project, ProjectMember
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

OWNER = make_token()
OTHER = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")


@pytest.fixture(autouse=True)
def fake_supabase(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    use_fake_supabase(monkeypatch)
    yield
    get_settings.cache_clear()


def headers(token: str, project_id: str | None = None) -> dict[str, str]:
    return {**bearer(token), **({"X-Project-Id": project_id} if project_id else {})}


def create(token: str, name: str = "Taskline") -> str:
    res = client.post("/api/projects", headers=bearer(token), json={"name": name, "prefix": "TL"})
    assert res.status_code == 200, res.json()
    return res.json()["id"]


def join(db: Session, token: str, project_id: str) -> str:
    """模擬成員已加入專案（邀請功能完成前直接寫入成員關係）"""
    member_id = client.get("/api/me", headers=bearer(token)).json()["id"]
    db.add(
        ProjectMember(
            project_id=uuid.UUID(project_id), member_id=uuid.UUID(member_id), role="Member", joined_at=datetime.now(UTC)
        )
    )
    db.commit()
    return member_id


def delete_project(token: str, project_id: str | None, name: str):
    return client.request("DELETE", "/api/project", headers=headers(token, project_id), json={"confirmName": name})


def test_leader_deletes_project_with_related_data(db: Session) -> None:
    pid = create(OWNER)
    client.post("/api/docs", headers=headers(OWNER, pid), json={"files": [{"name": "PRD.md", "size": 100}]})
    assert delete_project(OWNER, pid, "  Taskline ").status_code == 204
    assert client.get("/api/projects", headers=bearer(OWNER)).json() == []
    assert db.scalar(select(func.count()).select_from(Project)) == 0
    # 專案的文件、成員關係一併刪除
    assert db.scalar(select(func.count()).select_from(Document)) == 0
    assert db.scalar(select(func.count()).select_from(ProjectMember)) == 0


def test_delete_requires_matching_name(db: Session) -> None:
    pid = create(OWNER)
    res = delete_project(OWNER, pid, "taskline")
    assert (res.status_code, res.json()["code"]) == (422, "CONFIRM_MISMATCH")
    assert len(client.get("/api/projects", headers=bearer(OWNER)).json()) == 1


def test_delete_requires_explicit_project(db: Session) -> None:
    """沒有指定專案時不會改用最近加入的專案，避免刪錯"""
    create(OWNER)
    res = delete_project(OWNER, None, "Taskline")
    assert res.status_code == 404
    assert len(client.get("/api/projects", headers=bearer(OWNER)).json()) == 1


def test_only_leader_can_delete(db: Session) -> None:
    pid = create(OWNER)
    join(db, OTHER, pid)
    assert delete_project(OTHER, pid, "Taskline").status_code == 403
    assert db.scalar(select(func.count()).select_from(Project)) == 1


def test_cannot_delete_project_i_am_not_in(db: Session) -> None:
    pid = create(OWNER)
    create(OTHER, "別人的專案")
    assert delete_project(OTHER, pid, "Taskline").status_code == 404
    assert db.scalar(select(func.count()).select_from(Project)) == 2


def test_leader_removes_member(db: Session) -> None:
    pid = create(OWNER)
    member_id = join(db, OTHER, pid)
    assert len(client.get("/api/members", headers=headers(OWNER, pid)).json()) == 2
    assert client.delete(f"/api/members/{member_id}", headers=headers(OWNER, pid)).status_code == 204
    assert len(client.get("/api/members", headers=headers(OWNER, pid)).json()) == 1
    # 被移出的人看不到這個專案，但帳號仍然存在
    assert client.get("/api/projects", headers=bearer(OTHER)).json() == []
    assert client.get("/api/me", headers=bearer(OTHER)).status_code == 200


def test_cannot_remove_self_or_leader(db: Session) -> None:
    pid = create(OWNER)
    other_id = join(db, OTHER, pid)
    owner_id = client.get("/api/me", headers=bearer(OWNER)).json()["id"]
    res = client.delete(f"/api/members/{owner_id}", headers=headers(OWNER, pid))
    assert (res.status_code, res.json()["message"]) == (422, "不能把自己移出專案")
    # 成員不能移除別人（包括 Leader）
    assert client.delete(f"/api/members/{owner_id}", headers=headers(OTHER, pid)).status_code == 403
    assert client.delete(f"/api/members/{other_id}", headers=headers(OTHER, pid)).status_code == 403


def test_remove_unknown_member(db: Session) -> None:
    pid = create(OWNER)
    res = client.delete(f"/api/members/{uuid.uuid4()}", headers=headers(OWNER, pid))
    assert res.status_code == 404
