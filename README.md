# Taskline（Group-14）

以會議紀錄為起點的 Sprint 規劃與任務協作平台：AI 協助 Leader 拆解 Story 與任務、建議指派，成員在同一個地方接收任務、規劃執行、回報問題、送審驗收，最後完成回顧。

## 專案結構

```
Group-14/
├── frontend/            React + TypeScript + Vite（完整的 mock 模式，可獨立運作）
├── backend/             Python FastAPI（目前為架構，端點回傳 501）
├── docs/                架構說明與 API 對照表
├── setup.sh             第一次使用的初始化腳本
├── dev.sh               啟動前端（mock）或前後端（full）
├── docker-compose.yml   本機資料庫（選用，預設使用雲端 Supabase）
└── .github/             CI、PR 範本與決策紀錄
```

各資料夾的詳細說明：[frontend](frontend/README.md)、[backend](backend/README.md)、[docs](docs/README.md)。

## 快速開始

只要三步，不需要手動一步步設定：

```bash
git clone <repo 網址>
cd Group-14
./setup.sh        # 第一次：安裝套件、建立設定檔、輸入 Supabase 設定
./dev.sh          # 之後每次：選擇模式並啟動
```

事前只需要自己安裝 **Git** 與 **Node.js 22 以上**；uv（Python 套件管理）會由 `setup.sh` 詢問後自動安裝。
Windows 請在 Git Bash 或 WSL 執行這兩個腳本。

## 腳本說明

### `setup.sh`：第一次使用的初始化

```bash
./setup.sh             # 完整設定（前端 + 後端 + 登入）
./setup.sh --frontend  # 只做前端、只用模擬資料時
```

依序完成：

1. 檢查 Git、Node.js 版本；沒有 uv 時詢問是否自動安裝；檢查 Docker（選用）
2. 安裝前端套件，建立 `frontend/.env.local`
3. 安裝 Python 3.12 與後端套件，建立 `backend/.env`
4. Supabase 設定：團隊共用的公開值（Project URL、publishable key）會自動帶入，**只需要輸入資料庫密碼**（輸入時不會顯示，密碼中的特殊符號會自動處理）
5. GitHub 整合（選用）：GitHub App 的公開值自動帶入；只有在本機開發或測試 GitHub 功能的人，需要再輸入 Client secret 與 private key 檔案路徑（會檢查檔案格式，並把權限改成只有自己可讀）
6. 執行後端測試、檢查資料庫連線，並套用資料表遷移

可以重複執行：已完成的步驟會略過，不會覆蓋已填好的設定。設定有缺漏或資料庫連不上時，會直接說明原因與解決方式。

**每個人需要自己準備的機密值**

| 值 | 誰需要 | 向誰取得 |
|---|---|---|
| 資料庫密碼 | 要啟動後端的人 | 建立 Supabase 專案的人 |
| GitHub Client secret 與 private key（`.pem`） | 只有在本機開發 GitHub 整合的人 | GitHub App 擁有者（可以為每個人各產生一把 private key） |

機密值請用密碼管理工具或當面傳送，不要貼在群組或 commit。公開值已寫在 `.env.example`，不需要另外索取。

Supabase 與 GitHub 登入的團隊設定（整個團隊只需做一次，已完成）見 [docs/auth.md](docs/auth.md)。

### `dev.sh`：啟動開發環境

```bash
./dev.sh          # 顯示選單，輸入 1 或 2
./dev.sh mock     # 只啟動前端，使用模擬資料（不需要後端與登入）
./dev.sh full     # 同時啟動後端與前端，使用真正的 GitHub 登入與後端 API
```

| 模式 | 啟動的服務 | 適合 |
|---|---|---|
| `mock` | 前端 http://localhost:5173 | 開發畫面、展示流程；從右上角切換 Leader 與成員 |
| `full` | 後端 http://localhost:8000 （API 文件在 `/docs`）+ 前端 | 開發或測試後端、GitHub 登入 |

- 按 Ctrl+C 會一起關閉前後端
- 腳本會直接指定模式，不需要手動修改 `frontend/.env.local` 的 `VITE_USE_MOCK`
- 8000 port 被占用時：`BACKEND_PORT=8001 ./dev.sh full`
- `full` 模式會先檢查 Supabase 設定，缺少時會提示重新執行 `./setup.sh`
- 後端尚未實作的功能會顯示「尚未實作」，屬於正常狀況

## 日常開發

```bash
git pull          # 先同步 main 的最新內容
./setup.sh        # 有人新增套件或資料表遷移時（會自動 npm install、uv sync、alembic upgrade）
./dev.sh          # 啟動
```

後端有一部分測試需要資料庫（`backend/tests/db`），使用本機 Docker 的 Postgres，**不會連到共用的 Supabase**：

```bash
docker compose up -d     # 先開啟 Docker Desktop；本機 Postgres 在 port 5433
```

沒有啟動時這些測試會自動略過；CI 上會使用自己的 Postgres 服務一律執行。

發 PR 前先在本機跑一次 CI 會檢查的項目：

```bash
cd frontend && npm run lint && npm run build
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
```

## 常見問題

| 狀況 | 解決方式 |
|---|---|
| `permission denied: ./setup.sh` | 執行 `chmod +x setup.sh dev.sh` |
| `uv: command not found` | 安裝後要重新開啟終端機；仍然找不到時，依安裝程式最後的提示把路徑加入 PATH |
| `brew install uv` 跑了很久 | 部分 macOS 版本會從原始碼編譯，改用 `./setup.sh` 或官方安裝程式 `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| 資料庫連線失敗：`tenant/user ... not found` | 連線字串的使用者名稱要是 `postgres.<專案代號>`（Project URL 的子網域），不是專案名稱；到 Connect → Session pooler 重新複製 |
| 前端 port 不是 5173 | 5173 被占用時 Vite 會改用 5174、5175，後端與 Supabase 都已允許這三個 port |
| 前端出現 Network Error | 後端沒有啟動；用 `./dev.sh full` 會一起啟動 |
| GitHub 登入相關錯誤 | 見 [docs/auth.md](docs/auth.md) 的常見問題 |

<details>
<summary>不使用腳本的手動設定</summary>

```bash
# 前端
cd frontend
npm install
cp .env.example .env.local      # 填入 Supabase 設定（只用 mock 模式可以不填）
npm run dev                     # mock 模式；要接後端時在 .env.local 設 VITE_USE_MOCK=false

# 後端（需要先安裝 uv）
cd backend
cp .env.example .env            # 填入 DATABASE_URL（Supabase 要用 port 6543）與 SUPABASE_URL
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

只想用本機資料庫時：先開啟 Docker Desktop，在根目錄執行 `docker compose up -d`，
再把 `backend/.env` 的 `DATABASE_URL` 改成檔案裡註解的本機連線字串。清空本機資料庫：`docker compose down -v`。

</details>

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
