#!/usr/bin/env bash
# 一鍵啟動開發環境
#
#   ./dev.sh          顯示選單
#   ./dev.sh mock     只啟動前端，使用模擬資料（不需要後端與登入）
#   ./dev.sh full     同時啟動後端與前端，使用真正的 GitHub 登入與後端 API
#
# 按 Ctrl+C 會一起關閉前後端。Windows 請在 Git Bash 或 WSL 執行。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
BACKEND_PORT="${BACKEND_PORT:-8000}"

info() { printf '\033[36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; printf '  遇到問題可以執行 ./doctor.sh 檢查這台電腦的環境\n' >&2; exit 1; }

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

# 讀取 .env 類檔案中某個欄位的值（不載入整個檔案）
env_value() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | tr -d '"\r' || true
}

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

ensure_frontend() {
  command -v npm >/dev/null 2>&1 || fail "找不到 npm，請先安裝 Node.js 22 以上"
  if [ ! -d "$FRONTEND/node_modules" ]; then
    info "第一次啟動，安裝前端套件…"
    (cd "$FRONTEND" && npm install)
  fi
}

ensure_backend() {
  command -v uv >/dev/null 2>&1 || fail "找不到 uv，請先安裝：curl -LsSf https://astral.sh/uv/install.sh | sh（安裝後重新開啟終端機）"
  if [ ! -f "$BACKEND/.env" ]; then
    cp "$BACKEND/.env.example" "$BACKEND/.env"
    warn "已建立 backend/.env，請填入 DATABASE_URL 與 SUPABASE_URL（說明見 docs/auth.md）"
  fi
  [ -n "$(env_value "$BACKEND/.env" SUPABASE_URL)" ] || fail "backend/.env 尚未設定 SUPABASE_URL，無法驗證登入（說明見 docs/auth.md）"

  local env_file="$FRONTEND/.env.local"
  if [ -z "$(env_value "$env_file" VITE_SUPABASE_URL)" ] || [ -z "$(env_value "$env_file" VITE_SUPABASE_PUBLISHABLE_KEY)" ]; then
    fail "frontend/.env.local 尚未設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY（說明見 docs/auth.md）"
  fi

  if port_in_use "$BACKEND_PORT"; then
    fail "port $BACKEND_PORT 已被占用，請先關閉其他後端，或用 BACKEND_PORT=8001 ./dev.sh full 指定其他 port"
  fi
  info "同步後端套件…"
  (cd "$BACKEND" && uv sync --quiet)
}

BACKEND_PID=""
cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    info "關閉後端…"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}

run_mock() {
  ensure_frontend
  info "模擬資料模式：只啟動前端，從右上角切換 Leader 與成員"
  cd "$FRONTEND"
  VITE_USE_MOCK=true exec npm run dev
}

run_full() {
  ensure_frontend
  ensure_backend
  trap cleanup EXIT INT TERM

  info "啟動後端：http://localhost:$BACKEND_PORT/docs"
  # 用 python -m uvicorn，而不是 uvicorn：後者是 uv 在 .venv/Scripts 產生的 uvicorn.exe 啟動器，
  # 在啟用「應用程式控制」（Smart App Control／WDAC）的 Windows 會被擋下（os error 4551），python.exe 本身不會
  (cd "$BACKEND" && exec uv run python -m uvicorn app.main:app --reload --port "$BACKEND_PORT") &
  BACKEND_PID=$!

  # 等後端可以回應再啟動前端，避免一打開就出現連線錯誤
  for _ in $(seq 1 30); do
    if curl -fs "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then break; fi
    kill -0 "$BACKEND_PID" 2>/dev/null || fail "後端啟動失敗，請查看上方的錯誤訊息"
    sleep 0.5
  done

  info "啟動前端（真正的 GitHub 登入），按 Ctrl+C 會一起關閉前後端"
  cd "$FRONTEND"
  VITE_USE_MOCK=false VITE_API_URL="http://localhost:$BACKEND_PORT/api" npm run dev
}

MODE="${1:-}"
if [ -z "$MODE" ]; then
  echo "請選擇啟動模式："
  echo "  1) mock  只啟動前端，使用模擬資料"
  echo "  2) full  啟動後端與前端，使用真正的 GitHub 登入"
  read -r -p "輸入 1 或 2：" choice
  case "$choice" in
    1) MODE=mock ;;
    2) MODE=full ;;
    *) fail "請輸入 1 或 2" ;;
  esac
fi

case "$MODE" in
  mock) run_mock ;;
  full) run_full ;;
  -h | --help | help) usage ;;
  *) usage; exit 1 ;;
esac
