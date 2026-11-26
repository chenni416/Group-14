"""alembic.ini 必須是純 ASCII。

Alembic 讀設定檔時用系統語系編碼（encoding="locale"），不是 UTF-8。繁體中文 Windows 的語系是 cp950，
檔案裡只要有一個中文字，`alembic upgrade head` 與 tests/db 就會 UnicodeDecodeError。
macOS、Linux、CI 都是 UTF-8，不會壞，要等有人在 Windows 上跑才發現，所以在這裡擋。
"""

from pathlib import Path

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def test_alembic_ini_is_ascii_only() -> None:
    data = ALEMBIC_INI.read_bytes()
    bad = [
        (no, line.decode("utf-8", errors="replace").strip())
        for no, line in enumerate(data.splitlines(), start=1)
        if not line.isascii()
    ]
    assert not bad, (
        "alembic.ini 含有非 ASCII 字元（Alembic 以系統語系讀檔，繁中 Windows 的 cp950 會 UnicodeDecodeError）。"
        "註解請用英文，中文說明放到 docs/。問題的行：\n" + "\n".join(f"  第 {no} 行：{text}" for no, text in bad)
    )
