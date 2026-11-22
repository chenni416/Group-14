"""enable rls on alembic_version

Revision ID: 65acf281f419
Revises: d4a8795066ab
Create Date: 2026-11-22 23:55:50.319495
"""

from collections.abc import Sequence

from alembic import op

revision: str = "65acf281f419"
down_revision: str | None = "d4a8795066ab"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # alembic_version 由 Alembic 自動建立，不在任何遷移檔裡，需要另外啟用 RLS
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    op.execute("ALTER TABLE alembic_version DISABLE ROW LEVEL SECURITY")
