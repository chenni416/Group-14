# Taskline（Group-14）

以會議紀錄為起點的 Sprint 規劃與任務協作平台：AI 協助 Leader 拆解 Story 與任務、建議指派，成員在同一個地方接收任務、規劃執行、回報問題、送審驗收，最後完成回顧。

## 專案結構

```
Group-14/
├── frontend/            React + TypeScript + Vite（完整的 mock 模式，可獨立運作）
├── backend/             Python FastAPI（目前為架構，端點回傳 501）
├── docs/                架構說明與 API 對照表
├── docker-compose.yml   本機開發用的 PostgreSQL 與 Redis
└── .github/             CI、PR 範本與決策紀錄
```

各資料夾的詳細說明：[frontend](frontend/README.md)、[backend](backend/README.md)、[docs](docs/README.md)。

## 環境建置

### 1. 安裝必要工具（每台電腦只需要做一次）

依你負責的部分安裝即可：只做前端的人不需要 uv 和 Docker。

| 工具 | 版本 | 用途 | 誰需要 |
|---|---|---|---|
| Git | 任意 | 版本控制 | 所有人 |
| Node.js | 22 以上 | 前端 | 所有人 |
| uv | 最新版 | 管理 Python 與後端套件（會自動安裝 Python 3.12，不需要另外裝 Python） | 開發後端的人 |
| Docker Desktop | 最新版 | 本機的 PostgreSQL 與 Redis | 開發後端的人 |

安裝 uv：

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows（PowerShell）
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

> 部分 macOS 版本的 `brew install uv` 會從原始碼編譯（需要數小時），建議使用上面的官方安裝程式。

安裝完成後**重新開啟終端機**，確認版本：

```bash
git --version
node --version     # v22 以上
uv --version
docker --version
```

### 2. 取得專案

```bash
git clone <repo 網址>
cd Group-14
```

### 3. 前端（mock 模式，不需要後端）

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

打開網頁後，從右上角身分選單切換 Leader 與成員，體驗兩種角色的流程。

### 4. 後端（第一次）

先開啟 Docker Desktop，再執行：

```bash
# 在 repo 根目錄：啟動 PostgreSQL 與 Redis
docker compose up -d

# 安裝後端套件
cd backend
cp .env.example .env    # Windows 用 copy .env.example .env
uv sync                 # 第一次會自動下載 Python 3.12

# 確認環境正常
uv run pytest

# 啟動 API
uv run uvicorn app.main:app --reload
```

打開 http://localhost:8000/docs 看到 API 文件、http://localhost:8000/api/health 回傳 `{"status":"ok"}` 就代表成功。

`.env` 裡的金鑰（Supabase、Anthropic、GitHub）在對應功能開始實作時才需要填，由負責人提供，不要 commit。

### 5. 前端改為呼叫後端

在 `frontend/` 建立 `.env.local`，內容如下（這個檔案不會 commit）：

```
VITE_USE_MOCK=false
```

重新執行 `npm run dev`。後端尚未實作的功能會顯示「尚未實作」的錯誤訊息，屬於正常狀況；刪除 `.env.local` 或改回 `true` 就回到 mock 模式。

### 日常開發

```bash
git pull                       # 先同步 main 的最新內容

# 後端（套件或資料表有變動時）
cd backend
uv sync                        # 有人新增套件時
uv run alembic upgrade head    # 有人新增資料表遷移時
uv run uvicorn app.main:app --reload

# 前端
cd frontend
npm install                    # 有人新增套件時
npm run dev
```

發 PR 前先在本機跑一次 CI 會檢查的項目：

```bash
cd frontend && npm run lint && npm run build
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
```

### 常見問題

| 狀況 | 解決方式 |
|---|---|
| `uv: command not found` | 安裝後要重新開啟終端機；仍然找不到時，依安裝程式最後的提示把路徑加入 PATH |
| `docker compose up` 失敗 | 確認 Docker Desktop 已經開啟 |
| 5432 或 6379 port 被占用 | 本機已經有其他 Postgres 或 Redis 在執行，先關閉它們，或修改 `docker-compose.yml` 的 port |
| 前端 port 不是 5173 | 5173 被占用時 Vite 會改用其他 port；後端已允許 5173 與 5175，其他 port 要加進 `backend/.env` 的 `CORS_ORIGINS` |
| 前端出現 Network Error | 後端沒有啟動，或 `VITE_API_URL` 設定錯誤 |
| 想清空本機資料庫 | `docker compose down -v` 後再 `docker compose up -d` |

## 技術選擇

| 項目 | 選擇 |
|---|---|
| 前端 | React 18、TypeScript、Vite、Tailwind CSS、TanStack Query、Zustand |
| 後端 | Python 3.12、FastAPI、SQLAlchemy 2、Alembic、uv |
| 資料庫 | PostgreSQL（雲端使用 Supabase） |
| 登入 | Supabase Auth（GitHub 登入） |
| AI | Anthropic API |
| 版本與審查 | GitHub Pull Request（見 [DECISIONS.md](DECISIONS.md)） |

完整的架構與原因見 [docs/architecture.md](docs/architecture.md)。

## 協作流程

- 從 `main` 開分支，命名例如 `feat/...`、`fix/...`、`chore/...`
- 完成後發 PR 到 `main`，依 PR 範本填寫，由 code steward 審查
- CI 會自動檢查前端的 lint 與 build、後端的 lint、格式與測試
- 金鑰只放在 `.env`，不要 commit；新增設定時同步更新 `.env.example`

## 相關文件

- [DECISIONS.md](DECISIONS.md)：專案決策紀錄
- [CONTRIBUTORS.md](CONTRIBUTORS.md)：成員
- [Problem_Grounding_and_Evaluation_Plan_Draft.md](Problem_Grounding_and_Evaluation_Plan_Draft.md)：問題定義與評估計畫
- [AI_Usage_Guidelines](AI_Usage_Guidelines)：AI 使用規範
