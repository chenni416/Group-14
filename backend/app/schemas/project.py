"""組織、專案、審查策略與知識庫文件。對應 frontend/src/types/project.ts、review-policy.ts"""

from typing import Literal

from app.schemas.base import ApiModel
from app.schemas.member import MemberRole

ReviewMode = Literal["leader", "pool", "target"]
ReviewRule = Literal["any", "all"]
GitProvider = Literal["GitHub", "GitLab"]


class ReviewPolicy(ApiModel):
    mode: ReviewMode
    targets: list[str]
    """mode = target 時的指定審查者"""
    rule: ReviewRule
    """mode = target 時需 1 人或全員同意"""


class Team(ApiModel):
    name: str
    member_count: int
    current: bool


class Organization(ApiModel):
    name: str
    slug: str
    plan: str
    teams: list[Team]


class Project(ApiModel):
    name: str
    goal: str
    """G1：專案整體目標"""
    prefix: str
    provider: GitProvider
    repo: str
    branch_pattern: str
    sprint_length: str
    default_policy: ReviewPolicy
    git_integration: bool = False
    """是否整合 Git：true 時才進行 repo 連結與同步"""
    active_sprint_id: int
    planning_sprint_id: int | None
    """規劃中的 Sprint；null 表示目前沒有"""


class ProjectSummary(ApiModel):
    """「我的專案」清單的一項（側邊欄的專案切換用）"""

    id: str
    name: str
    prefix: str
    role: MemberRole
    """我在這個專案的角色"""


class CreateProjectInput(ApiModel):
    name: str
    prefix: str
    """專案代碼，例如 TL；只保留英文大寫與數字"""
    goal: str = ""


class DeleteProjectInput(ApiModel):
    confirm_name: str
    """再次輸入專案名稱，與目前名稱相同才會刪除"""


class UpdateProjectInput(ApiModel):
    """只傳要修改的欄位（不能直接改 active / planning Sprint）"""

    name: str | None = None
    goal: str | None = None
    prefix: str | None = None
    provider: GitProvider | None = None
    repo: str | None = None
    branch_pattern: str | None = None
    sprint_length: str | None = None
    default_policy: ReviewPolicy | None = None
    git_integration: bool | None = None


class KnowledgeDoc(ApiModel):
    id: str
    name: str
    kind: str
    size: str
    progress: int
    """處理進度 0–100"""
    chunks: int
    is_link: bool


class UploadDocInput(ApiModel):
    name: str
    size: int


class UploadDocsBody(ApiModel):
    files: list[UploadDocInput]


class AddLinkBody(ApiModel):
    url: str


class SearchHit(ApiModel):
    source: str
    excerpt: str
    score: float
