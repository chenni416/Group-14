#!/usr/bin/env bash
# 第一次使用的初始化設定（可以重複執行，已完成的步驟會略過）
#
#   ./setup.sh             完整設定：前端 + 後端 + 登入設定
#   ./setup.sh --frontend  只設定前端（只用模擬資料開發時）
#
# 會做的事：檢查必要工具、安裝 uv（詢問後）、安裝前後端套件、建立設定檔並帶入團隊的公開設定、
# 詢問機密值（資料庫密碼；選用的 GitHub 整合金鑰）、檢查資料庫連線、執行測試確認環境正常。
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

# 團隊共用的公開值（寫在 .env.example）：個人設定檔的欄位還沒填時自動帶入
fill_public() {
  local file="$1" example="$2" key="$3" value
  value="$(env_value "$example" "$key")"
  if ! is_placeholder "$(env_value "$file" "$key")"; then
    ok "$key 已設定"
  elif ! is_placeholder "$value"; then
    set_env "$file" "$key" "$value"
    ok "$key 已帶入團隊設定"
  else
    ask_env "$file" "$key" "$key"
  fi
}

# 檔案權限只有自己可讀（mode & 077 為 0）
file_private() { node -e 'process.exit(require("fs").statSync(process.argv[1]).mode & 0o077 ? 1 : 0)' "$1"; }

# 確認 private key 檔案存在、格式正確，權限太寬時改為只有自己可讀
check_pem() {
  local path="$1"
  if [ ! -f "$path" ]; then
    warn "找不到 private key：${path}"
    return 1
  fi
  if ! grep -q "BEGIN .*PRIVATE KEY" "$path"; then
    warn "${path} 不是 private key 檔案（應該是 GitHub App 頁面下載的 .pem）"
    return 1
  fi
  if ! file_private "$path"; then
    chmod 600 "$path"
    ok "已將 private key 權限改為只有自己可讀"
  fi
  case "$path" in "$ROOT"/*) warn "private key 放在 repo 資料夾內，建議移到 repo 以外（例如 ~/.taskline/）";; esac
  ok "private key 檔案正確"
}

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

step "4. Supabase 設定"
echo "  團隊共用的公開值會自動帶入；只需要輸入資料庫密碼。按 Enter 可以先略過。"
fill_public "$FRONTEND_ENV" "$FRONTEND/.env.example" VITE_SUPABASE_URL
fill_public "$FRONTEND_ENV" "$FRONTEND/.env.example" VITE_SUPABASE_PUBLISHABLE_KEY
fill_public "$BACKEND_ENV" "$BACKEND/.env.example" SUPABASE_URL

# 資料庫：沿用 .env.example 的連線字串範本，只詢問密碼
DB_URL="$(env_value "$BACKEND_ENV" DATABASE_URL)"
DB_TEMPLATE="$(env_value "$BACKEND/.env.example" DATABASE_URL)"
if is_placeholder "$DB_URL" && [[ "$DB_TEMPLATE" == *"<資料庫密碼>"* ]] && [[ "$DB_URL" != "$DB_TEMPLATE" ]]; then
  set_env "$BACKEND_ENV" DATABASE_URL "$DB_TEMPLATE"
  DB_URL="$DB_TEMPLATE"
fi
if ! is_placeholder "$DB_URL"; then
  ok "DATABASE_URL 已設定"
elif $INTERACTIVE && [[ "$DB_URL" == *"<資料庫密碼>"* ]]; then
  echo "  資料庫密碼請向建立 Supabase 專案的人取得（也可以貼上完整的連線字串）"
  read -r -s -p "  資料庫密碼（輸入時不會顯示）：" DB_PASSWORD
  echo
  if [ -z "$DB_PASSWORD" ]; then
    warn "DATABASE_URL 先略過，之後可重新執行 ./setup.sh"
  elif [[ "$DB_PASSWORD" == postgres://* || "$DB_PASSWORD" == postgresql* ]]; then
    set_env "$BACKEND_ENV" DATABASE_URL "$DB_PASSWORD"
    ok "DATABASE_URL 已寫入"
  else
    # 密碼裡的 @ : / # 等符號要編碼，連線字串才不會被拆錯
    ENCODED="$(PW="$DB_PASSWORD" node -p 'encodeURIComponent(process.env.PW)')"
    set_env "$BACKEND_ENV" DATABASE_URL "${DB_URL/<資料庫密碼>/$ENCODED}"
    ok "DATABASE_URL 已寫入"
  fi
  unset DB_PASSWORD ENCODED
else
  ask_env "$BACKEND_ENV" DATABASE_URL "資料庫連線字串（Supabase → Connect → Session pooler，輸入時不會顯示）" true
fi

# Supabase 複製的連線字串開頭是 postgresql://，自動改成 SQLAlchemy 需要的格式
DB_URL="$(env_value "$BACKEND_ENV" DATABASE_URL)"
if [[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]]; then
  DB_URL="postgresql+psycopg://${DB_URL#*://}"
  [[ "$DB_URL" == *"sslmode="* || "$DB_URL" == *"localhost"* ]] || DB_URL="${DB_URL}$([[ "$DB_URL" == *"?"* ]] && echo "&" || echo "?")sslmode=require"
  set_env "$BACKEND_ENV" DATABASE_URL "$DB_URL"
  ok "DATABASE_URL 已轉換為 postgresql+psycopg:// 格式"
fi

# ---------- 5. GitHub 整合（選用） ----------

step "5. GitHub 整合（選用：只有在本機開發或測試 GitHub 功能的人需要）"
fill_public "$BACKEND_ENV" "$BACKEND/.env.example" GITHUB_APP_ID
fill_public "$BACKEND_ENV" "$BACKEND/.env.example" GITHUB_APP_SLUG
fill_public "$BACKEND_ENV" "$BACKEND/.env.example" GITHUB_CLIENT_ID

GITHUB_READY=false
GH_SECRET="$(env_value "$BACKEND_ENV" GITHUB_CLIENT_SECRET)"
GH_PEM="$(env_value "$BACKEND_ENV" GITHUB_PRIVATE_KEY_PATH)"
if ! is_placeholder "$GH_SECRET" && ! is_placeholder "$GH_PEM"; then
  ok "GITHUB_CLIENT_SECRET 已設定"
  check_pem "$GH_PEM" && GITHUB_READY=true
elif $INTERACTIVE; then
  echo "  需要 GitHub App 擁有者提供的 Client secret 與 private key（.pem）檔案。"
  read -r -p "  要現在設定嗎？[y/N] " setup_github
  if [[ "${setup_github:-n}" =~ ^[Yy]$ ]]; then
    ask_env "$BACKEND_ENV" GITHUB_CLIENT_SECRET "Client secret（輸入時不會顯示）" true
    if is_placeholder "$(env_value "$BACKEND_ENV" GITHUB_PRIVATE_KEY_PATH)"; then
      read -r -p "  private key 檔案路徑（建議放在 ~/.taskline/github-app.pem）：" pem_path
      pem_path="${pem_path/#\~/$HOME}"
      if [ -n "$pem_path" ] && check_pem "$pem_path"; then
        set_env "$BACKEND_ENV" GITHUB_PRIVATE_KEY_PATH "$(cd "$(dirname "$pem_path")" && pwd)/$(basename "$pem_path")"
        ok "GITHUB_PRIVATE_KEY_PATH 已寫入"
      fi
    else
      check_pem "$(env_value "$BACKEND_ENV" GITHUB_PRIVATE_KEY_PATH)" || true
    fi
    ! is_placeholder "$(env_value "$BACKEND_ENV" GITHUB_CLIENT_SECRET)" && check_pem "$(env_value "$BACKEND_ENV" GITHUB_PRIVATE_KEY_PATH)" >/dev/null 2>&1 && GITHUB_READY=true
  else
    info "略過 GitHub 整合；之後需要時重新執行 ./setup.sh"
  fi
else
  info "未設定 GitHub 金鑰，略過"
fi

# ---------- 6. 檢查 ----------

step "6. 檢查環境"
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
  $GITHUB_READY && echo "  GitHub 整合：已設定" || echo "  GitHub 整合：未設定（不影響登入與其他功能）"
else
  warn "還缺少：${MISSING[*]}，目前只能使用 ./dev.sh mock；補齊後重新執行 ./setup.sh 即可使用 ./dev.sh full"
fi
