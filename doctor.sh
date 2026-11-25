#!/usr/bin/env bash
# 環境檢查：找出這台電腦上會讓 setup.sh、dev.sh 或後端出問題的地方，並告訴你怎麼修。
#
#   ./doctor.sh              完整檢查（含網路：Supabase 與資料庫連線）
#   ./doctor.sh --offline    不連網路，只檢查本機的工具、檔案與設定
#   ./doctor.sh --strict     警告也算失敗（CI 用）
#
# 只讀取、不會修改任何檔案，也不會印出任何密碼或金鑰（只印欄位名稱與是否已填）。
# 結束碼：0＝沒有失敗，1＝有失敗。Windows 請在 Git Bash 或 WSL 執行。

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
BACKEND_ENV="$BACKEND/.env"
FRONTEND_ENV="$FRONTEND/.env.local"

OFFLINE=false
STRICT=false
for arg in "$@"; do
  case "$arg" in
    --offline) OFFLINE=true ;;
    --strict) STRICT=true ;;
    -h | --help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "不認得的參數：$arg（見 ./doctor.sh --help）" >&2; exit 2 ;;
  esac
done

FAILS=0
WARNS=0
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓ %s\033[0m\n' "$*"; }
info() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; WARNS=$((WARNS + 1)); }
bad() { printf '\033[31m✗ %s\033[0m\n' "$*"; FAILS=$((FAILS + 1)); }
hint() { printf '    → %s\n' "$*"; }

# 注意：不要用 grep -c $'\r' 計算 CR：Git Bash 的 grep 會把它當成空模式，每一行都算
cr_count() { tr -cd '\r' <"$1" | wc -c | tr -d ' '; }
non_ascii_count() { LC_ALL=C tr -d '\000-\177' <"$1" | wc -c | tr -d ' '; }

# 讀 .env 類檔案的某個欄位（去掉 CR 與引號）
env_value() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | tr -d '\r"' || true
}
is_placeholder() { [ -z "$1" ] || [[ "$1" == *"<"*">"* ]]; }

# port 是否已被占用（要啟動服務前用）。注意各平台的陷阱：
# - Windows 的 Git Bash 沒有 lsof；用 /dev/tcp 探測「沒人監聽」的 port 每次要等約 2 秒，而且 Vite 只聽 IPv6（::1）、
#   uvicorn 只聽 IPv4（127.0.0.1），只探測其中一個會誤判。所以改用 netstat（0.4 秒，一次看到 IPv4 與 IPv6）
# - WSL／Linux：非 root 的 lsof 看不到 root 的程序（例如 docker-proxy）與 Windows 端的程序，所以先用連線探測
port_in_use() {
  local p="$1"
  case "$(uname -s)" in
    MINGW* | MSYS* | CYGWIN*)
      netstat -ano 2>/dev/null | tr -d '\r' | grep -qE "[:.]${p}[[:space:]]+[^[:space:]]+[[:space:]]+LISTENING"
      return
      ;;
  esac
  (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null && return 0
  (exec 3<>"/dev/tcp/::1/$p") 2>/dev/null && return 0
  command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1
}

# 某個位址的 TCP port 連得上嗎（本機資料庫在 WSL 的 Docker 裡，Windows 的 netstat 看不到，要用連線探測）
tcp_open() { (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null; }

# ---------- 1. 環境 ----------

step "1. 作業系統與專案位置"
OS="其他"
case "$(uname -s)" in
  Darwin) OS="macOS" ;;
  Linux) if grep -qi microsoft /proc/version 2>/dev/null; then OS="WSL"; else OS="Linux"; fi ;;
  MINGW* | MSYS* | CYGWIN*) OS="Windows（Git Bash）" ;;
esac
ok "$OS"
if [ "$OS" = "WSL" ] && [[ "$ROOT" == /mnt/* ]]; then
  warn "專案放在 Windows 磁碟（$ROOT）：在 WSL 裡檔案讀寫很慢，換行符號也容易出問題"
  hint "建議在 WSL 的家目錄重新 clone：cd ~ && git clone <repo 網址>"
fi

# ---------- 2. 工具 ----------

step "2. 必要工具"
if command -v git >/dev/null 2>&1; then ok "git $(git --version | awk '{print $3}')"; else bad "找不到 git"; hint "https://git-scm.com/downloads"; fi

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -ge 22 ]; then ok "node $(node --version)"; else bad "node $(node --version)：需要 22 以上"; hint "https://nodejs.org"; fi
  command -v npm >/dev/null 2>&1 && ok "npm $(npm --version)" || bad "找不到 npm（通常和 Node.js 一起安裝）"
else
  bad "找不到 Node.js"
  hint "https://nodejs.org 安裝 22 以上的版本"
fi

HAVE_UV=false
if command -v uv >/dev/null 2>&1; then
  HAVE_UV=true
  ok "$(uv --version | awk '{print "uv " $2}')"
else
  bad "找不到 uv（管理 Python 與後端套件）"
  hint "curl -LsSf https://astral.sh/uv/install.sh | sh（Windows 的 Git Bash 也適用），裝完重新開啟終端機"
fi

command -v curl >/dev/null 2>&1 && ok "curl" || warn "找不到 curl（dev.sh 等待後端啟動、doctor 檢查 Supabase 會用到）"

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then ok "docker（服務運作中）"; else warn "docker 已安裝，但服務沒有啟動（本機資料庫才需要）"; hint "啟動 Docker Desktop，或在 WSL 執行 sudo service docker start"; fi
else
  info "沒有 docker：只使用雲端 Supabase 資料庫時不需要"
  if command -v wsl.exe >/dev/null 2>&1 && wsl.exe -e sh -c 'command -v docker' >/dev/null 2>&1; then
    info "但 WSL 裡有 docker：可以在 WSL 執行 docker compose up -d db，Windows 端用 127.0.0.1:5433 連線（不需要 Docker Desktop）"
  fi
fi

# ---------- 3. 專案檔案 ----------

step "3. 專案檔案"
# 只檢查 shell 腳本：CRLF 會讓它們在 WSL／Linux／macOS 直接失敗；Git Bash 剛好容忍，但換到 WSL 就會壞
CRLF_FILES=()
for f in "$ROOT/setup.sh" "$ROOT/dev.sh" "$ROOT/doctor.sh"; do
  [ -f "$f" ] && [ "$(cr_count "$f")" -gt 0 ] && CRLF_FILES+=("${f#"$ROOT"/}")
done
if [ ${#CRLF_FILES[@]} -eq 0 ]; then
  ok "腳本的換行符號正確（LF）"
else
  MSG="這些腳本是 CRLF（Windows 換行）：${CRLF_FILES[*]}"
  if [ "$OS" = "Windows（Git Bash）" ]; then
    warn "$MSG（Git Bash 能執行，但在 WSL 會壞：env: 'bash\r': No such file or directory）"
  else
    bad "$MSG：會出現 env: 'bash\r': No such file or directory"
  fi
  hint "先確認這些檔案沒有你的修改，再執行：rm ${CRLF_FILES[*]} && git checkout -- ${CRLF_FILES[*]}（repo 有 .gitattributes 後會以 LF 檢出）"
fi

if [ -f "$BACKEND/alembic.ini" ]; then
  if [ "$(non_ascii_count "$BACKEND/alembic.ini")" -eq 0 ]; then
    ok "alembic.ini 是純 ASCII"
  else
    bad "alembic.ini 含有非 ASCII 字元：Alembic 用系統語系讀檔，在繁體中文 Windows（cp950）上會 UnicodeDecodeError"
    hint "把 alembic.ini 裡的中文註解刪掉或改成英文"
  fi
fi

if [ -d "$FRONTEND/node_modules" ]; then ok "前端套件已安裝"; else warn "前端套件還沒安裝"; hint "./setup.sh（或 cd frontend && npm install）"; fi
if $HAVE_UV; then
  if [ -d "$BACKEND/.venv" ]; then
    if (cd "$BACKEND" && uv sync --frozen --check >/dev/null 2>&1); then ok "後端套件與 uv.lock 同步"; else warn "後端套件與 uv.lock 不同步（有人新增了套件）"; hint "cd backend && uv sync"; fi
  else
    warn "後端套件還沒安裝"; hint "./setup.sh（或 cd backend && uv sync）"
  fi
fi

# ---------- 4. 設定檔 ----------

step "4. 設定檔（只顯示欄位名稱，不顯示內容）"
check_key() {
  local file="$1" key="$2" label="${3:-$2}" required="${4:-required}"
  if [ ! -f "$file" ]; then return; fi
  if is_placeholder "$(env_value "$file" "$key")"; then
    if [ "$required" = required ]; then warn "$label 還沒填"; MISSING_ANY=true; else info "$label 未設定（選用）"; fi
  else
    ok "$label 已設定"
  fi
}
MISSING_ANY=false
if [ -f "$FRONTEND_ENV" ]; then
  check_key "$FRONTEND_ENV" VITE_SUPABASE_URL
  check_key "$FRONTEND_ENV" VITE_SUPABASE_PUBLISHABLE_KEY
else
  warn "frontend/.env.local 不存在（只用 ./dev.sh mock 時不需要）"; hint "./setup.sh"
fi
if [ -f "$BACKEND_ENV" ]; then
  check_key "$BACKEND_ENV" SUPABASE_URL
  check_key "$BACKEND_ENV" DATABASE_URL "DATABASE_URL（資料庫密碼）"
  check_key "$BACKEND_ENV" OPENAI_API_KEY "OPENAI_API_KEY（AI 功能）" optional
  check_key "$BACKEND_ENV" GITHUB_CLIENT_SECRET "GITHUB_CLIENT_SECRET（GitHub 整合）" optional
  if [ -f "$FRONTEND_ENV" ]; then
    FRONT_URL="$(env_value "$FRONTEND_ENV" VITE_SUPABASE_URL)"
    BACK_URL="$(env_value "$BACKEND_ENV" SUPABASE_URL)"
    if [ -n "$FRONT_URL" ] && [ -n "$BACK_URL" ] && [ "$FRONT_URL" != "$BACK_URL" ]; then
      bad "前後端的 Supabase 網址不一樣（VITE_SUPABASE_URL 與 SUPABASE_URL）：登入後後端會一直回 401"
      hint "兩邊要是同一個 Supabase 專案；重新執行 ./setup.sh 會帶入團隊設定"
    fi
  fi
  if [ "$(cr_count "$BACKEND_ENV")" -gt 0 ]; then
    info "backend/.env 是 CRLF（從 Windows 換行的範本複製來的）：Python 讀得懂，不影響使用"
  fi
else
  warn "backend/.env 不存在"; hint "./setup.sh"
fi

# ---------- 5. 連線 ----------

step "5. 連線與 port"
for p in 8000 5173; do
  if port_in_use "$p"; then
    info "port $p 使用中（如果是你已經啟動的 ./dev.sh，這是正常的）"
  else
    ok "port $p 可用"
  fi
done
if tcp_open 127.0.0.1 5433; then ok "本機資料庫（port 5433）有在運作"; else info "本機資料庫（port 5433）沒有啟動：只在跑 backend/tests/db 時需要，docker compose up -d"; fi

if $OFFLINE; then
  info "--offline：略過 Supabase 與資料庫連線檢查"
else
  SUPA="$(env_value "$BACKEND_ENV" SUPABASE_URL)"
  if is_placeholder "$SUPA"; then
    info "沒有 SUPABASE_URL，略過 Supabase 連線檢查"
  elif command -v curl >/dev/null 2>&1; then
    CODE="$(curl -sS -m 10 -o /dev/null -w '%{http_code}' "${SUPA%/}/auth/v1/.well-known/jwks.json" 2>/dev/null || echo 000)"
    if [ "$CODE" = 200 ]; then ok "Supabase 專案連得上（登入金鑰可取得）"; else warn "Supabase 回應 $CODE：網址不對，或沒有網路"; hint "確認 SUPABASE_URL 是 Project Settings → API 的 Project URL"; fi
  fi

  if is_placeholder "$(env_value "$BACKEND_ENV" DATABASE_URL)"; then
    info "DATABASE_URL 尚未設定，略過資料庫檢查"
  elif ! $HAVE_UV || [ ! -d "$BACKEND/.venv" ]; then
    info "後端套件還沒安裝，略過資料庫檢查"
  else
    while IFS= read -r line; do
      case "${line%% *}" in
        OK) ok "${line#* }" ;;
        WARN) warn "${line#* }" ;;
        FAIL) bad "${line#* }" ;;
        HINT) hint "${line#* }" ;;
      esac
    done < <(cd "$BACKEND" && PYTHONUTF8=1 PYTHONIOENCODING=utf-8 uv run --frozen python scripts/doctor_db.py 2>&1)
  fi
fi

# ---------- 結果 ----------

step "結果"
if [ "$FAILS" -eq 0 ] && [ "$WARNS" -eq 0 ]; then
  ok "環境正常"
  exit 0
fi
[ "$FAILS" -gt 0 ] && printf '\033[31m%s 個失敗\033[0m  ' "$FAILS"
[ "$WARNS" -gt 0 ] && printf '\033[33m%s 個警告\033[0m' "$WARNS"
echo
[ "$FAILS" -gt 0 ] && exit 1
$STRICT && exit 1
exit 0
