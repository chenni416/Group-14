"""產生 docs/api-status.md：每個 API 端點的實作狀態、資料來源與驗證方式。

只用 AST 解析 app/api/routes/*.py，不載入應用程式（不需要資料庫與環境設定）。

    uv run python scripts/route_status.py          # 重新產生 docs/api-status.md
    uv run python scripts/route_status.py --check  # 檢查檔案是否是最新（tests/test_api_status_doc.py 與 CI 使用）

判斷規則（寫在這裡，產生的表才看得懂）：
- 狀態：函式內呼叫 `not_implemented(` → 501；只對部分身分 `raise ApiError(code="NOT_IMPLEMENTED")` → 部分實作；
  其餘為已實作
- 資料來源：參數型別含 `Db` → 資料庫；含 `Store` → 記憶體（MemoryStore）；兩者都有 → 兩者（依登入身分分岔）
- 驗證：參數型別含 `AccountMember` → 登入（帳號層級）；含 `CurrentMember`／`CurrentUser` → 登入（專案範圍）；
  函式內呼叫 `require_leader` 或 `_leader_project` → Leader；
  都沒有 → 無（任何人可呼叫）
"""

import ast
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTES = ROOT / "app" / "api" / "routes"
OUT = ROOT.parent / "docs" / "api-status.md"
METHODS = {"get", "post", "put", "patch", "delete"}
LEADER_CALLS = ("require_leader(", "_leader_project(")


@dataclass(frozen=True)
class Route:
    group: str
    method: str
    path: str
    operation_id: str
    status: str
    source: str
    auth: str


def _decorator(fn: ast.FunctionDef | ast.AsyncFunctionDef) -> tuple[str, str, str] | None:
    for d in fn.decorator_list:
        if isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute) and d.func.attr in METHODS and d.args:
            op = next(
                (k.value.value for k in d.keywords if k.arg == "operation_id" and isinstance(k.value, ast.Constant)), ""
            )
            return d.func.attr.upper(), str(d.args[0].value), str(op)
    return None


def collect() -> list[Route]:
    routes: list[Route] = []
    for file in sorted(ROUTES.glob("*.py")):
        if file.name == "__init__.py":
            continue
        tree = ast.parse(file.read_text(encoding="utf-8"))
        for fn in (n for n in tree.body if isinstance(n, ast.FunctionDef | ast.AsyncFunctionDef)):
            deco = _decorator(fn)
            if deco is None:
                continue
            method, path, op = deco
            annotations = " ".join(
                ast.unparse(a.annotation) for a in fn.args.args + fn.args.kwonlyargs if a.annotation is not None
            )
            body = ast.unparse(fn)
            if "not_implemented(" in body:
                status = "501"
            elif "NOT_IMPLEMENTED" in body:
                status = "部分實作"  # 某些身分可用、某些身分回 501
            else:
                status = "已實作"
            uses_db, uses_store = "Db" in annotations, "Store" in annotations
            source = (
                "資料庫＋記憶體（依身分）"
                if uses_db and uses_store
                else "資料庫"
                if uses_db
                else "記憶體"
                if uses_store
                else "—"
            )
            if any(c in body for c in LEADER_CALLS):
                auth = "Leader"
            elif "AccountMember" in annotations:
                auth = "登入（帳號）"
            elif "CurrentMember" in annotations or "CurrentUser" in annotations:
                auth = "登入"
            else:
                auth = "無"
            routes.append(Route(file.stem, method, "/api" + path, op, status, "—" if status == "501" else source, auth))
    return routes


def render(routes: list[Route]) -> str:
    done = sum(r.status != "501" for r in routes)
    lines = [
        "# API 實作狀態",
        "",
        "> 這份文件由 `backend/scripts/route_status.py` 自動產生，**不要手動修改**。"
        "新增或修改路由後執行 `uv run python scripts/route_status.py` 更新；"
        "`tests/test_api_status_doc.py` 與 CI 會檢查它是不是最新。",
        "",
        f"共 {len(routes)} 個端點：**{done} 個已實作或部分實作**、{len(routes) - done} 個尚未實作"
        "（呼叫時回 `501 NOT_IMPLEMENTED`）。",
        "",
        "| 欄位 | 說明 |",
        "|---|---|",
        "| 資料來源 | 資料庫＝讀寫 Supabase／Postgres 資料表；記憶體＝`MemoryStore`（全域、不分專案、重啟即重置）；"
        "「資料庫＋記憶體」＝GitHub 登入的成員走資料庫、`X-Demo-User` 示範成員走記憶體 |",
        "| 驗證 | 無＝不需要登入（任何人可呼叫）；"
        "登入＝需要有效的 Supabase token，且 `X-Project-Id` 若有帶，必須是我所屬的專案"
        "（否則 400／403）；登入（帳號）＝帳號層級的端點（`/me`、專案清單、邀請、通知），不檢查 `X-Project-Id`；"
        "Leader＝另外要求專案角色為 Leader |",
        "",
        "GitHub 連結（`github` 群組）的 Leader 檢查在 `services/github_link.py` 內，所以這裡顯示為「登入」。",
        "",
    ]
    for group in sorted({r.group for r in routes}):
        rs = [r for r in routes if r.group == group]
        lines += [
            f"## {group}（{sum(r.status != '501' for r in rs)}／{len(rs)} 已實作）",
            "",
            "| 方法 | 路徑 | operationId | 狀態 | 資料來源 | 驗證 |",
            "|---|---|---|---|---|---|",
        ]
        lines += [f"| {r.method} | `{r.path}` | `{r.operation_id}` | {r.status} | {r.source} | {r.auth} |" for r in rs]
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    text = render(collect())
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current.replace("\r\n", "\n") != text:
            print("docs/api-status.md 已過期，請執行：uv run python scripts/route_status.py", file=sys.stderr)
            return 1
        return 0
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"已更新 {OUT.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
