"""專案連結 GitHub repo：建立專案時填寫 repo、GitHub App 安裝流程、選擇 repo、解除連結。

GitHub API 以假資料取代（monkeypatch app.integrations.github.client），不會連到 GitHub。
"""

import uuid
from collections.abc import Iterator
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.integrations.github import client as gh
from app.main import app
from app.models import GithubInstallation, Project
from tests.auth_helpers import bearer, make_token, use_fake_supabase

client = TestClient(app)

OWNER = make_token()
OTHER = make_token(sub="5f0c6a8e-1d2b-4c3a-9e8f-000000000999", github_id=2002, login="hubot")
INSTALLATION_ID = 777
REPOS = [
    gh.Repository(
        id=11,
        full_name="octocat/Taskline",
        html_url="https://github.com/octocat/Taskline",
        default_branch="main",
        private=False,
    ),
    gh.Repository(
        id=12,
        full_name="octocat/other",
        html_url="https://github.com/octocat/other",
        default_branch="dev",
        private=True,
    ),
]


class FakeGitHub:
    """記錄呼叫並回傳假資料"""

    def __init__(self) -> None:
        self.user_installations = {INSTALLATION_ID}
        self.repos = list(REPOS)
        self.codes: list[str] = []

    def exchange_user_code(self, code: str) -> str:
        self.codes.append(code)
        return "user-token"

    def user_installation_ids(self, _token: str) -> set[int]:
        return self.user_installations

    def get_installation(self, installation_id: int) -> gh.Installation:
        return gh.Installation(
            id=installation_id,
            account_id=1001,
            account_login="octocat",
            account_type="User",
            account_avatar_url=None,
            repository_selection="selected",
        )

    def list_installation_repositories(self, _installation_id: int) -> list[gh.Repository]:
        return self.repos


@pytest.fixture(autouse=True)
def fake_github(monkeypatch: pytest.MonkeyPatch) -> Iterator[FakeGitHub]:
    use_fake_supabase(monkeypatch)
    monkeypatch.setenv("GITHUB_APP_SLUG", "taskline-test")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "test-client-secret")
    get_settings.cache_clear()
    fake = FakeGitHub()
    for name in ("exchange_user_code", "user_installation_ids", "get_installation", "list_installation_repositories"):
        monkeypatch.setattr(gh, name, getattr(fake, name))
    yield fake
    get_settings.cache_clear()


def headers(token: str, project_id: str) -> dict[str, str]:
    return {**bearer(token), "X-Project-Id": project_id}


def create(token: str = OWNER, **extra) -> str:
    body = {"name": "Taskline", "prefix": "TL", "gitIntegration": True, "repo": "https://github.com/octocat/Taskline"}
    res = client.post("/api/projects", headers=bearer(token), json={**body, **extra})
    assert res.status_code == 200, res.json()
    return res.json()["id"]


def start(token: str, pid: str) -> str:
    """取得安裝網址，回傳其中的 state"""
    res = client.get("/api/github/install-url", headers=headers(token, pid))
    assert res.status_code == 200, res.json()
    url = urlparse(res.json()["url"])
    assert (url.netloc, url.path) == ("github.com", "/apps/taskline-test/installations/new")
    return parse_qs(url.query)["state"][0]


def complete(token: str, state: str, **extra):
    body = {"state": state, "code": "oauth-code", "installationId": INSTALLATION_ID, "setupAction": "install", **extra}
    return client.post("/api/github/installations", headers=bearer(token), json=body)


def project(token: str, pid: str) -> dict:
    return client.get("/api/project", headers=headers(token, pid)).json()


# ---------- 建立專案時填寫 repo ----------


@pytest.mark.parametrize(
    "repo",
    [
        "https://github.com/octocat/Taskline",
        "github.com/octocat/Taskline.git",
        "octocat/Taskline",
        "https://www.github.com/octocat/Taskline/",
    ],
)
def test_create_project_normalizes_repo(db: Session, repo: str) -> None:
    pid = create(repo=repo, sprintLength="1 週")
    p = project(OWNER, pid)
    assert (p["repo"], p["githubRepoUrl"], p["githubLinkStatus"]) == (
        "octocat/Taskline",
        "https://github.com/octocat/Taskline",
        "none",
    )
    assert (p["gitIntegration"], p["sprintLength"]) == (True, "1 週")


def test_create_project_validation(db: Session) -> None:
    def post(**body):
        return client.post("/api/projects", headers=bearer(OWNER), json={"name": "X", "prefix": "X", **body})

    assert post(gitIntegration=True).status_code == 422  # 整合時 repo 必填
    assert post(gitIntegration=True, repo="not a repo").status_code == 422
    assert post(gitIntegration=True, repo="https://gitlab.com/a/b").status_code == 422
    assert post(sprintLength="4 週").status_code == 422
    # 不整合時 repo 可以不填，也可以填
    assert post().status_code == 200
    assert post(repo="octocat/notes").status_code == 200


# ---------- 安裝流程 ----------


def test_link_flow_binds_repo(db: Session, fake_github: FakeGitHub) -> None:
    pid = create()
    res = complete(OWNER, start(OWNER, pid))
    assert res.json() == {"status": "linked", "repoFullName": "octocat/Taskline", "repositories": []}
    assert fake_github.codes == ["oauth-code"]
    p = project(OWNER, pid)
    assert (p["githubLinkStatus"], p["repo"]) == ("linked", "octocat/Taskline")
    row = db.get(Project, uuid.UUID(pid))
    assert (row.github_installation_id, row.github_repo_id, row.github_default_branch) == (INSTALLATION_ID, 11, "main")
    inst = db.get(GithubInstallation, INSTALLATION_ID)
    assert (inst.account_login, inst.status) == ("octocat", "active")


def test_repo_match_is_case_insensitive(db: Session) -> None:
    pid = create(repo="OctoCat/taskline")
    assert complete(OWNER, start(OWNER, pid)).json()["status"] == "linked"
    assert project(OWNER, pid)["repo"] == "octocat/Taskline"  # 以 GitHub 上的名稱為準


def test_installation_must_belong_to_user(db: Session, fake_github: FakeGitHub) -> None:
    """貼上別人的 installation_id 不能綁定"""
    pid = create()
    fake_github.user_installations = {999}
    res = complete(OWNER, start(OWNER, pid))
    assert (res.status_code, res.json()["code"]) == (403, "INSTALLATION_NOT_YOURS")
    assert project(OWNER, pid)["githubLinkStatus"] == "none"
    assert db.get(GithubInstallation, INSTALLATION_ID) is None


def test_tampered_or_foreign_state_is_rejected(db: Session) -> None:
    pid = create()
    state = start(OWNER, pid)
    body, sig = state.split(".")
    assert complete(OWNER, f"{body}.{sig[:-2]}xx").json()["code"] == "INVALID_STATE"
    assert complete(OWNER, "garbage").json()["code"] == "INVALID_STATE"
    # 別人拿到 state 也不能用
    client.get("/api/me", headers=bearer(OTHER))
    res = complete(OTHER, state)
    assert (res.status_code, res.json()["code"]) == (403, "INVALID_STATE")


def test_install_request_is_pending(db: Session) -> None:
    """不是 repo 擁有者時只送出安裝請求，等待核准"""
    pid = create()
    res = complete(OWNER, start(OWNER, pid), setupAction="request", installationId=None, code=None)
    assert res.json()["status"] == "pending"
    assert project(OWNER, pid)["githubLinkStatus"] == "pending"


def test_choose_repo_when_installation_lacks_it(db: Session, fake_github: FakeGitHub) -> None:
    pid = create(repo="octocat/missing")
    res = complete(OWNER, start(OWNER, pid)).json()
    assert res["status"] == "choose_repo"
    assert [r["fullName"] for r in res["repositories"]] == ["octocat/Taskline", "octocat/other"]
    assert project(OWNER, pid)["githubLinkStatus"] == "none"

    bad = client.put("/api/github/repository", headers=headers(OWNER, pid), json={"repoFullName": "octocat/missing"})
    assert (bad.status_code, bad.json()["code"]) == (422, "REPO_NOT_AUTHORIZED")
    ok = client.put("/api/github/repository", headers=headers(OWNER, pid), json={"repoFullName": "octocat/other"})
    assert ok.json() == {"status": "linked", "repoFullName": "octocat/other", "repositories": []}
    assert project(OWNER, pid)["repo"] == "octocat/other"


def test_repo_can_only_link_one_project(db: Session) -> None:
    first = create()
    assert complete(OWNER, start(OWNER, first)).json()["status"] == "linked"
    second = create(name="另一個專案")
    res = complete(OWNER, start(OWNER, second))
    assert (res.status_code, res.json()["code"]) == (409, "REPO_ALREADY_LINKED")


def test_unlink_keeps_repo_url(db: Session) -> None:
    pid = create()
    complete(OWNER, start(OWNER, pid))
    assert client.delete("/api/github/repository", headers=headers(OWNER, pid)).status_code == 204
    p = project(OWNER, pid)
    assert (p["githubLinkStatus"], p["repo"]) == ("none", "octocat/Taskline")
    # 解除後可以重新連結
    assert complete(OWNER, start(OWNER, pid)).json()["status"] == "linked"


# ---------- 權限 ----------


def test_only_leader_with_git_integration_can_link(db: Session) -> None:
    pid = create(gitIntegration=False, repo=None)
    res = client.get("/api/github/install-url", headers=headers(OWNER, pid))
    assert (res.status_code, res.json()["code"]) == (422, "GIT_INTEGRATION_OFF")
    # 一般成員（還沒有專案）不能連結
    client.get("/api/me", headers=bearer(OTHER))
    res = client.get("/api/github/install-url", headers=headers(OTHER, pid))
    assert res.status_code == 404


def test_not_configured(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "")
    get_settings.cache_clear()
    pid = create()
    res = client.get("/api/github/install-url", headers=headers(OWNER, pid))
    assert (res.status_code, res.json()["code"]) == (503, "GITHUB_NOT_CONFIGURED")
