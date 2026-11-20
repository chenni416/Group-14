"""組織、專案、審查策略與知識庫文件。對應 frontend/src/types/project.ts、review-policy.ts"""

from typing import Literal

from app.schemas.base import ApiModel

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
    active_sprint_id: int
    planning_sprint_id: int | None
    """規劃中的 Sprint；null 表示目前沒有"""


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
