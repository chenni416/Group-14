"""Alembic 遷移環境：連線字串與資料表定義都來自 app，不需要另外設定"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.core.config import get_settings
from app.models import Base

config = context.config
# 測試會透過 config.attributes 指定測試資料庫；否則使用 MIGRATION_DATABASE_URL，
# 沒設定時沿用 DATABASE_URL（Supabase 的 6543 會自動換成 5432，見 config.py）。
# ConfigParser 會把 % 當成特殊符號，編碼過的密碼（例如 p%40ss）要先跳脫
_url = config.attributes.get("database_url") or get_settings().resolved_migration_database_url
config.set_main_option("sqlalchemy.url", _url.replace("%", "%%"))
if config.config_file_name is not None:
    # disable_existing_loggers=False：預設會停用所有已存在的 logger，在程序內執行遷移（例如 tests/db）時
    # 會讓 app.* 的日誌（請求日誌、project fallback 警告）無聲消失
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
