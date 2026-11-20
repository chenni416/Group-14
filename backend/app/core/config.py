"""應用程式設定：全部從環境變數（或 backend/.env）讀取，欄位說明見 .env.example"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5175"]

    # 資料庫：本機為 docker-compose 的 Postgres，雲端為 Supabase 的連線字串
    database_url: str = "postgresql+psycopg://taskline:taskline@localhost:5432/taskline"

    # 登入：Supabase Auth 簽發的 JWT，由後端驗證
    supabase_url: str = ""
    supabase_jwt_secret: str = ""

    # 檔案儲存：Supabase Storage
    supabase_service_role_key: str = ""
    storage_bucket: str = "documents"

    # LLM：Anthropic API
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"

    # 背景工作
    redis_url: str = "redis://localhost:6379/0"

    # GitHub App（同步 PR 狀態）
    github_app_id: str = ""
    github_webhook_secret: str = ""
    github_private_key_path: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
