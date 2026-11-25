"""環境一致性的守門測試。

這些問題只會在特定平台或設定下出現（繁體中文 Windows、WSL、macOS 的舊版 bash…），平常開發時看不到，
所以用靜態檢查在每個平台防止回歸。每個測試的訊息都說明「出事時會怎樣」。
"""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
SCRIPTS = ["setup.sh", "dev.sh", "doctor.sh"]

pytestmark = pytest.mark.skipif(
    not (ROOT / ".gitattributes").exists(), reason="只有完整的 repo（含根目錄檔案）才檢查，例如 Docker 映像裡沒有"
)


def git(*args: str) -> str:
    if shutil.which("git") is None:
        pytest.skip("沒有 git")
    res = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        pytest.skip(f"不是 git 工作目錄：{res.stderr.strip()[:80]}")
    return res.stdout


def test_alembic_ini_is_ascii() -> None:
    """Alembic 讀 alembic.ini 用系統語系編碼（encoding="locale"，PYTHONUTF8 也沒用）。
    含中文時，繁體中文 Windows（cp950）會 UnicodeDecodeError，alembic upgrade 與 tests/db 全部失敗"""
    raw = (BACKEND / "alembic.ini").read_bytes()
    bad = [i for i, b in enumerate(raw) if b > 127]
    assert not bad, f"alembic.ini 含非 ASCII 字元（位置 {bad[:3]}…），請改成英文"


def test_gitattributes_forces_lf() -> None:
    """沒有 .gitattributes 時，Windows 預設的 core.autocrlf=true 會把腳本轉成 CRLF，
    在 WSL 會出現 env: 'bash\\r': No such file or directory"""
    text = (ROOT / ".gitattributes").read_text(encoding="utf-8")
    assert re.search(r"^\*\s+text=auto\s+eol=lf\s*$", text, re.M), "缺少 `* text=auto eol=lf`"
    assert re.search(r"^\*\.sh\s+text\s+eol=lf\s*$", text, re.M), "缺少 `*.sh text eol=lf`"


def test_scripts_are_lf_and_executable_in_git() -> None:
    """檢查 git 裡存的內容（別人 clone 到的），不看本機工作目錄：
    CRLF 會讓腳本在 Linux／macOS／WSL 失敗；沒有執行權限則 ./setup.sh 會 Permission denied"""
    eol = git("ls-files", "--eol", *SCRIPTS)
    for line in eol.splitlines():
        assert line.startswith("i/lf"), f"索引裡不是 LF：{line.strip()}"
    stage = git("ls-files", "-s", *SCRIPTS)
    for line in stage.splitlines():
        assert line.startswith("100755"), f"沒有執行權限（要 git update-index --chmod=+x）：{line.strip()}"
    assert len(stage.splitlines()) == len(SCRIPTS), "有腳本沒被 git 追蹤"


@pytest.mark.skipif(shutil.which("bash") is None, reason="沒有 bash")
@pytest.mark.parametrize("name", SCRIPTS)
def test_scripts_have_valid_bash_syntax(name: str) -> None:
    """用 bash -n 檢查語法。把 CR 去掉再檢查：Git Bash 容忍 CRLF，Linux 不會，這裡只看腳本本身有沒有寫錯"""
    source = (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
    assert source.startswith(b"#!/usr/bin/env bash"), f"{name} 缺少 #!/usr/bin/env bash"
    res = subprocess.run(["bash", "-n"], input=source, capture_output=True)
    assert res.returncode == 0, res.stderr.decode("utf-8", "replace")


def test_local_database_defaults_use_ip_not_localhost() -> None:
    """Windows 解析 localhost 會先試 IPv6（::1），每次資料庫連線實測多等約 15 秒才退回 IPv4，
    DB 測試因此慢到像當掉。本機資料庫一律用 127.0.0.1"""
    from app.core.config import Settings

    sources = {
        "config.py 的預設值": Settings.model_fields["database_url"].default,
        "tests/db/conftest.py": (BACKEND / "tests" / "db" / "conftest.py").read_text(encoding="utf-8"),
        "backend/.env.example": (BACKEND / ".env.example").read_text(encoding="utf-8"),
        "docs/database.md": (ROOT / "docs" / "database.md").read_text(encoding="utf-8"),
    }
    for where, text in sources.items():
        assert "@localhost:" not in text, f"{where} 的資料庫位址用了 localhost，請改成 127.0.0.1"


def test_backend_env_example_matches_settings() -> None:
    """.env.example 裡的每個欄位（含被註解掉的範例）都要是真的設定。
    否則使用者填了沒作用，或像已移除的 ANTHROPIC_*、REDIS_URL 一樣誤導人"""
    from app.core.config import Settings

    known = {name.upper() for name in Settings.model_fields}
    text = (BACKEND / ".env.example").read_text(encoding="utf-8")
    keys = set(re.findall(r"^#?\s*([A-Z][A-Z0-9_]+)=", text, re.M))
    assert keys, "沒有解析到任何欄位"
    unknown = sorted(keys - known)
    assert not unknown, f".env.example 有 Settings 沒有的欄位：{unknown}"


def test_frontend_env_example_keys_are_used() -> None:
    """frontend/.env.example 的 VITE_ 欄位都要在前端程式碼裡真的被讀取"""
    text = (ROOT / "frontend" / ".env.example").read_text(encoding="utf-8")
    keys = set(re.findall(r"^#?\s*(VITE_[A-Z0-9_]+)=", text, re.M))
    assert keys, "沒有解析到任何 VITE_ 欄位"
    source = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "frontend" / "src").rglob("*.ts*"))
    unused = sorted(k for k in keys if f"import.meta.env.{k}" not in source)
    assert not unused, f"前端沒有使用這些 VITE_ 欄位：{unused}"


def test_dev_script_starts_backend_with_python_module() -> None:
    """`uv run uvicorn` 會執行 uv 在 .venv/Scripts 產生的 uvicorn.exe 啟動器；啟用「應用程式控制」
    （Smart App Control／WDAC）的 Windows 會擋下新建立的未簽章執行檔（Failed to spawn: uvicorn, os error 4551）。
    改用 `python -m uvicorn`，走已被信任的 python.exe"""
    source = (ROOT / "dev.sh").read_bytes().decode("utf-8")
    assert "uv run uvicorn" not in source, "dev.sh 請用 `uv run python -m uvicorn`"
    assert "python -m uvicorn" in source
