"""資料庫與遷移的環境檢查，由根目錄的 ./doctor.sh 呼叫（也可以單獨執行）。

    cd backend && uv run python scripts/doctor_db.py

輸出每行一個結果，開頭是 OK／WARN／FAIL／HINT，由 doctor.sh 整理成畫面。
**不會印出連線字串或密碼**，只印主機、port 與使用者名稱。
結束碼：0＝沒有 FAIL，1＝有 FAIL。
"""

import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

failed = False


def say(kind: str, text: str) -> None:
    global failed
    failed = failed or kind == "FAIL"
    print(f"{kind} {text}", flush=True)


def describe(url: str) -> tuple[str, int | None, str]:
    """(主機, port, 使用者)；不含密碼"""
    parts = urlsplit(url.replace("postgresql+psycopg://", "postgresql://", 1))
    return parts.hostname or "?", parts.port, parts.username or "?"


def classify(error: Exception) -> tuple[str, str]:
    """把常見的連線錯誤轉成人看得懂的原因與解法（只看錯誤文字的關鍵字，不輸出原文，避免洩漏連線資訊）"""
    text = str(error).lower()
    if "tenant or user not found" in text or "tenant/user" in text:
        return (
            "使用者名稱不正確（Supabase pooler 的使用者要是 postgres.<專案代號>，不是專案名稱）",
            "到 Supabase 專案頁面上方 Connect → Transaction pooler 重新複製連線字串",
        )
    if "password authentication failed" in text or "authentication failed" in text:
        return "密碼不正確", "向建立 Supabase 專案的人確認資料庫密碼，修改 backend/.env 的 DATABASE_URL"
    if "timeout" in text or "timed out" in text:
        return (
            "連線逾時",
            "檢查網路（有些網路會擋 port 6543 或 5432）；本機資料庫在 Windows 請用 127.0.0.1 而不是 localhost"
            "（localhost 會先試 IPv6，每次多等約 15 秒）",
        )
    if "could not translate host" in text or "name or service not known" in text or "getaddrinfo" in text:
        return "找不到主機（網址拼錯，或沒有網路）", "檢查 DATABASE_URL 的主機名稱與網路連線"
    if "connection refused" in text or "could not connect" in text or "actively refused" in text:
        return "主機拒絕連線（資料庫沒有啟動，或 port 不對）", "本機資料庫：在 repo 根目錄執行 docker compose up -d"
    if "remaining connection slots" in text or "max clients" in text:
        return (
            "資料庫連線數已滿",
            "DATABASE_URL 要用 port 6543（Transaction pooler）；並關掉 DBeaver、psql 等沒關的連線",
        )
    if "ssl" in text:
        return "SSL 設定不符", "Supabase 需要 ?sslmode=require；本機 Docker 資料庫不要加"
    return "無法連線", "確認 DATABASE_URL 的主機、port、使用者與密碼"


def check_migrations(conn) -> None:
    """資料庫的遷移版本和目前程式碼的是否一致（用已經開好的連線，不多佔一條）"""
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    heads = set(ScriptDirectory.from_config(cfg).get_heads())
    current = set(MigrationContext.configure(conn).get_current_heads())
    if len(heads) > 1:
        say("FAIL", f"遷移檔分岔（有 {len(heads)} 個 head）：兩個人同時新增了遷移")
        say("HINT", "執行 uv run alembic heads 查看，需要有人合併分岔（alembic merge）")
    elif current == heads:
        say("OK", "資料表遷移已是最新版本")
    elif not current:
        say("WARN", "資料庫還沒有套用任何遷移")
        say("HINT", "在 backend/ 執行 uv run alembic upgrade head（或重新執行 ./setup.sh）")
    else:
        say("WARN", "資料表遷移不是最新版本（資料庫落後或領先目前的程式碼）")
        say("HINT", "git pull 後，在 backend/ 執行 uv run alembic upgrade head（或重新執行 ./setup.sh）")


def probe(url: str, label: str, *, migrations: bool) -> bool:
    """用這個連線字串連一次資料庫（和應用程式一樣不保留連線）；成功時可以順便檢查遷移版本"""
    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import NullPool

    # prepare_threshold=None：和 app/db/session.py 一樣，Transaction pooler 不支援 prepared statement
    engine = create_engine(url, poolclass=NullPool, connect_args={"connect_timeout": 10, "prepare_threshold": None})
    try:
        with engine.connect() as conn:
            conn.execute(text("select 1"))
            say("OK", f"{label}連線正常")
            if migrations:
                check_migrations(conn)
        return True
    except Exception as exc:  # 檢查腳本要把任何連線錯誤轉成說明，不能中斷
        reason, hint = classify(exc)
        say("FAIL", f"{label}連不上：{reason}")
        say("HINT", hint)
        return False
    finally:
        engine.dispose()


def main() -> int:
    from app.core.config import get_settings

    settings = get_settings()
    url = settings.database_url
    host, port, user = describe(url)
    say("OK", f"DATABASE_URL：主機 {host}、port {port}、使用者 {user}")

    if "localhost" in url and sys.platform == "win32":
        say("WARN", "DATABASE_URL 用 localhost：Windows 會先試 IPv6，每次連線多等約 15 秒")
        say("HINT", "改成 127.0.0.1")
    if ".pooler.supabase.com" in url and port == 5432:
        say("WARN", "DATABASE_URL 用 port 5432（Session pooler）：幾個人同時開後端就會把免費版的 15 條連線占滿")
        say("HINT", "改成 port 6543（Transaction pooler）；重新執行 ./setup.sh 會自動修正")

    # 遷移用的連線字串：Supabase 的 6543 會自動改走 5432（見 core/config.py）。
    # 兩條都要測：應用程式用 DATABASE_URL，遷移用另一條；有些網路只擋其中一個 port
    migration_url = settings.resolved_migration_database_url
    if migration_url == url:
        probe(url, "資料庫", migrations=True)
    else:
        probe(url, "應用程式使用的資料庫（DATABASE_URL）", migrations=False)
        _, port_m, _ = describe(migration_url)
        probe(migration_url, f"遷移用的資料庫（port {port_m}）", migrations=True)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
