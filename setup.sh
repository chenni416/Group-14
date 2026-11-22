#!/usr/bin/env bash
# 第一次使用的初始化設定（可以重複執行，已完成的步驟會略過）
#
#   ./setup.sh             完整設定：前端 + 後端 + 登入設定
#   ./setup.sh --frontend  只設定前端（只用模擬資料開發時）
#
# 會做的事：檢查必要工具、安裝 uv（詢問後）、安裝前後端套件、建立設定檔、
# 互動輸入 Supabase 設定、檢查資料庫連線、執行測試確認環境正常。
# 完成後用 ./dev.sh 啟動。Windows 請在 Git Bash 或 WSL 執行。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
FRONTEND_ENV="$FRONTEND/.env.local"
BACKEND_ENV="$BACKEND/.env"
INTERACTIVE=false
[ -t 0 ] && INTERACTIVE=true

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓ %s\033[0m\n' "$*"; }
info() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; }

ONLY_FRONTEND=false
case "${1:-}" in
  "") ;;
  --frontend) ONLY_FRONTEND=true ;;
  -h | --help) usage; exit 0 ;;
  *) usage; exit 1 ;;
esac

# ---------- 設定檔讀寫 ----------

env_value() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- || true
}

# 寫入或取代 KEY=value；用 node 處理，值裡有 / & ? @ 等符號也不會出錯
set_env() {
  KEY="$2" VALUE="$3" node -e '
    const fs = require("fs");
    const [file] = process.argv.slice(1);
    const { KEY, VALUE } = process.env;
    let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const line = `${KEY}=${VALUE}`;
    const re = new RegExp(`^${KEY}=.*$`, "m");
    text = re.test(text) ? text.replace(re, () => line) : text.replace(/\n?$/, "\n") + line + "\n";
    fs.writeFileSync(file, text);
  ' "$1"
}

is_placeholder() { [ -z "$1" ] || [[ "$1" == *"<"*">"* ]]; }

# 欄位已有值就略過；沒有值時互動詢問（secret=true 時輸入不顯示）
ask_env() {
  local file="$1" key="$2" prompt="$3" secret="${4:-false}" current answer
  current="$(env_value "$file" "$key")"
  if ! is_placeholder "$current"; then
    ok "$key 已設定"
    return
  fi
  if ! $INTERACTIVE; then
    warn "$key 尚未設定（請手動填入 ${file#"$ROOT"/}）"
    return
  fi
  if [ "$secret" = true ]; then
    read -r -s -p "  ${prompt}：" answer
    echo
  else
    read -r -p "  ${prompt}：" answer
  fi
  answer="$(printf '%s' "$answer" | tr -d '[:space:]')"
  if [ -z "$answer" ]; then
    warn "$key 先略過，之後可重新執行 ./setup.sh 或手動填入"
  else
    set_env "$file" "$key" "$answer"
    ok "$key 已寫入"
  fi
}

# ---------- 1. 檢查工具 ----------

step "1. 檢查必要工具"
command -v git >/dev/null 2>&1 || fail "找不到 git，請先安裝 Git"
ok "git $(git --version | awk '{print $3}')"

command -v node >/dev/null 2>&1 || fail "找不到 Node.js，請到 https://nodejs.org 安裝 22 以上的版本"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js 版本為 $(node --version)，需要 22 以上"
ok "node $(node --version)"

if ! $ONLY_FRONTEND; then
  if ! command -v uv >/dev/null 2>&1; then
    warn "找不到 uv（管理 Python 與後端套件）"
    install_uv=n
    if $INTERACTIVE; then read -r -p "  要現在用官方安裝程式安裝嗎？[Y/n] " install_uv; install_uv="${install_uv:-y}"; fi
    if [[ "$install_uv" =~ ^[Yy]$ ]]; then
      curl -LsSf https://astral.sh/uv/install.sh | sh
      export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
      command -v uv >/dev/null 2>&1 || fail "uv 安裝完成但找不到指令，請重新開啟終端機後再執行 ./setup.sh"
    else
      fail "請先安裝 uv：curl -LsSf https://astral.sh/uv/install.sh | sh，重新開啟終端機後再執行 ./setup.sh"
    fi
  fi
  ok "$(uv --version)"

  if command -v docker >/dev/null 2>&1; then
    ok "docker（選用：本機資料庫）"
  else
    info "沒有 Docker：只會用到雲端 Supabase 資料庫時不需要"
  fi
fi

# ---------- 2. 前端 ----------

step "2. 前端"
info "安裝前端套件…"
(cd "$FRONTEND" && npm install --no-fund --no-audit --loglevel=error)
ok "前端套件已安裝"

if [ ! -f "$FRONTEND_ENV" ]; then
  cp "$FRONTEND/.env.example" "$FRONTEND_ENV"
  ok "已建立 frontend/.env.local"
else
  ok "frontend/.env.local 已存在"
fi

if $ONLY_FRONTEND; then
  step "完成"
  echo "執行 ./dev.sh mock 啟動前端（模擬資料）"
  exit 0
fi

# ---------- 3. 後端 ----------

step "3. 後端"
info "安裝 Python 3.12 與後端套件（第一次需要一點時間）…"
(cd "$BACKEND" && uv sync --quiet)
ok "後端套件已安裝"

if [ ! -f "$BACKEND_ENV" ]; then
  cp "$BACKEND/.env.example" "$BACKEND_ENV"
  ok "已建立 backend/.env"
else
  ok "backend/.env 已存在"
fi

# ---------- 4. Supabase 設定 ----------

step "4. Supabase 設定（從 Supabase 後台複製，說明見 docs/auth.md）"
echo "  直接按 Enter 可以先略過；已經填過的欄位不會再詢問。"
echo "  Project URL 與 publishable key：Project Settings → API Keys"

ask_env "$FRONTEND_ENV" VITE_SUPABASE_URL "Project URL（https://xxxx.supabase.co）"
SUPABASE_URL_VALUE="$(env_value "$FRONTEND_ENV" VITE_SUPABASE_URL)"
# 前後端使用同一個 Supabase 專案，後端直接沿用
if ! is_placeholder "$SUPABASE_URL_VALUE" && is_placeholder "$(env_value "$BACKEND_ENV" SUPABASE_URL)"; then
  set_env "$BACKEND_ENV" SUPABASE_URL "$SUPABASE_URL_VALUE"
  ok "SUPABASE_URL 已同步到 backend/.env"
else
  ask_env "$BACKEND_ENV" SUPABASE_URL "Project URL（後端）"
fi
ask_env "$FRONTEND_ENV" VITE_SUPABASE_PUBLISHABLE_KEY "publishable key（sb_publishable_ 開頭，舊版叫 anon key）"

echo "  資料庫連線字串：專案頁面上方 Connect → Session pooler"
echo "  格式：postgresql+psycopg://postgres.<專案代號>:<密碼>@<主機>:5432/postgres?sslmode=require"
ask_env "$BACKEND_ENV" DATABASE_URL "資料庫連線字串（輸入時不會顯示）" true

# Supabase 複製的連線字串開頭是 postgresql://，自動改成 SQLAlchemy 需要的格式
DB_URL="$(env_value "$BACKEND_ENV" DATABASE_URL)"
if [[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]]; then
  DB_URL="postgresql+psycopg://${DB_URL#*://}"
  [[ "$DB_URL" == *"sslmode="* || "$DB_URL" == *"localhost"* ]] || DB_URL="${DB_URL}$([[ "$DB_URL" == *"?"* ]] && echo "&" || echo "?")sslmode=require"
  set_env "$BACKEND_ENV" DATABASE_URL "$DB_URL"
  ok "DATABASE_URL 已轉換為 postgresql+psycopg:// 格式"
fi

# ---------- 5. 檢查 ----------

step "5. 檢查環境"
info "執行後端測試…"
if (cd "$BACKEND" && uv run pytest -q >/dev/null 2>&1); then
  ok "後端測試通過"
else
  fail "後端測試失敗，請在 backend/ 執行 uv run pytest 查看原因"
fi

if is_placeholder "$(env_value "$BACKEND_ENV" DATABASE_URL)"; then
  warn "DATABASE_URL 尚未設定，略過資料庫連線檢查"
else
  info "檢查資料庫連線…"
  if (cd "$BACKEND" && uv run python -c "
from sqlalchemy import create_engine, text
from app.core.config import get_settings
with create_engine(get_settings().database_url, connect_args={'connect_timeout': 10}).connect() as c:
    c.execute(text('select 1'))
" >/dev/null 2>&1); then
    ok "資料庫連線正常"
    info "套用資料表遷移…"
    (cd "$BACKEND" && uv run alembic upgrade head >/dev/null 2>&1) && ok "資料表已是最新版本" || warn "資料表遷移失敗，請在 backend/ 執行 uv run alembic upgrade head 查看原因"
  else
    # 常見錯誤：使用者名稱填成專案名稱，應該是 postgres.<Project URL 的子網域>
    REF="$(env_value "$BACKEND_ENV" SUPABASE_URL | sed -E 's#https?://([^.]+)\..*#\1#')"
    DB_USER="$(env_value "$BACKEND_ENV" DATABASE_URL | sed -E 's#^[^:]+://([^:@]+).*#\1#')"
    if [ -n "$REF" ] && [[ "$DB_USER" == postgres.* ]] && [ "$DB_USER" != "postgres.$REF" ]; then
      warn "連不上資料庫：DATABASE_URL 的使用者名稱是 ${DB_USER}，應該是 postgres.${REF}（專案代號，不是專案名稱）"
      warn "請到 Supabase 專案頁面上方 Connect → Session pooler 重新複製完整連線字串，修改 backend/.env 後重新執行 ./setup.sh"
    else
      warn "連不上資料庫：確認 DATABASE_URL 的密碼與主機（建議使用 Session pooler），修改 backend/.env 後重新執行 ./setup.sh"
    fi
  fi
fi

MISSING=()
for pair in "$FRONTEND_ENV:VITE_SUPABASE_URL" "$FRONTEND_ENV:VITE_SUPABASE_PUBLISHABLE_KEY" "$BACKEND_ENV:SUPABASE_URL"; do
  is_placeholder "$(env_value "${pair%%:*}" "${pair##*:}")" && MISSING+=("${pair##*:}")
done

step "完成"
if [ ${#MISSING[@]} -eq 0 ]; then
  echo "  ./dev.sh mock   只啟動前端（模擬資料）"
  echo "  ./dev.sh full   啟動前後端（GitHub 登入）"
else
  warn "還缺少：${MISSING[*]}，目前只能使用 ./dev.sh mock；補齊後重新執行 ./setup.sh 即可使用 ./dev.sh full"
fi
