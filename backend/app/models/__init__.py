"""所有資料表都要在這裡匯入，Alembic autogenerate 才找得到"""

from app.models.base import Base
from app.models.github_installation import GithubInstallation
from app.models.member import Member
from app.models.project import Project
from app.models.project_invitation import ProjectInvitation
from app.models.project_member import ProjectMember

__all__ = ["Base", "GithubInstallation", "Member", "Project", "ProjectInvitation", "ProjectMember"]
