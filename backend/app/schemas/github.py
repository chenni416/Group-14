"""GitHub repo 連結（GitHub App 安裝流程）"""

from typing import Literal

from app.schemas.base import ApiModel


class InstallUrl(ApiModel):
    url: str
    """GitHub App 的安裝網址（含簽章過的 state）"""


class CompleteInstallationInput(ApiModel):
    """GitHub 安裝完成後帶回前端 /github/callback 的參數"""

    state: str
    code: str | None = None
    """使用者授權碼：用來確認這個安裝是登入者可以存取的"""
    installation_id: int | None = None
    setup_action: str | None = None
    """install、update；request 表示送出安裝請求、等待 repo 擁有者核准"""


class GithubRepository(ApiModel):
    id: int
    full_name: str
    html_url: str
    private: bool


class LinkResult(ApiModel):
    status: Literal["linked", "pending", "choose_repo"]
    """linked 已連結；pending 等待 repo 擁有者核准；choose_repo 安裝沒有包含填寫的 repo，請從授權的 repo 中選擇"""
    repo_full_name: str | None = None
    """已連結或原本填寫的 repo"""
    repositories: list[GithubRepository] = []
    """status 為 choose_repo 時，這個安裝授權的 repo"""


class ChooseRepositoryInput(ApiModel):
    repo_full_name: str
