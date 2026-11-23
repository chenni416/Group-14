"""所有資料表都要在這裡匯入，Alembic autogenerate 才找得到"""

from app.models.backlog_item import BacklogItem
from app.models.base import Base
from app.models.collab import Issue, IssueResponse, Notification, Proposal, ProposalComment, TaskComment
from app.models.document import Document
from app.models.execution import ExecutionPlan, PromptThread, TaskChatMessage
from app.models.github_commit import GithubCommit
from app.models.github_installation import GithubInstallation
from app.models.github_pull_request import GithubPullRequest
from app.models.github_webhook_event import GithubWebhookEvent
from app.models.member import Member
from app.models.project import Project
from app.models.project_invitation import ProjectInvitation
from app.models.project_member import ProjectMember
from app.models.review import AcceptanceRecord, Retro, RetroAction, RetroEntry
from app.models.sprint import Sprint
from app.models.task import Task, TaskDependency

__all__ = [
    "BacklogItem",
    "Base",
    "AcceptanceRecord",
    "Retro",
    "RetroAction",
    "RetroEntry",
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
    "ExecutionPlan",
    "PromptThread",
    "TaskChatMessage",
    "TaskComment",
    "Issue",
    "IssueResponse",
    "Proposal",
    "ProposalComment",
    "Notification",
]
