"""所有資料表都要在這裡匯入，Alembic autogenerate 才找得到"""

from app.models.backlog_item import BacklogItem
from app.models.base import Base
from app.models.document import Document
from app.models.github_commit import GithubCommit
from app.models.github_installation import GithubInstallation
from app.models.github_pull_request import GithubPullRequest
from app.models.github_webhook_event import GithubWebhookEvent
from app.models.member import Member
from app.models.project import Project
from app.models.project_invitation import ProjectInvitation
from app.models.project_member import ProjectMember
from app.models.sprint import Sprint
from app.models.task import Task, TaskDependency

__all__ = [
    "BacklogItem",
    "Base",
    "Base",
    "GithubCommit",
    "GithubInstallation",
    "GithubPullRequest",
    "GithubWebhookEvent",
    "Member",
    "Project",
    "ProjectInvitation",
    "ProjectMember",
    "Sprint",
    "Document",
    "Task",
    "TaskDependency",
]
