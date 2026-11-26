# 系統架構

## 整體架構

```
前端 React（frontend/）
   │  HTTPS，路徑與資料格式依 frontend/src/services/contracts.ts
後端 FastAPI（backend/）
   ├─ PostgreSQL ──────── 業務資料（本機 docker-compose；雲端 Supabase）
   ├─ 記憶體資料層 ─────── Sprint、任務、規劃（MemoryStore，遷移到資料庫前的過渡）
   ├─ Supabase Auth ───── GitHub 登入，後端只驗證 JWT
   ├─ OpenAI API ──────── LLM（gpt-4.1，結構化輸出）
   └─ GitHub App ──────── 安裝與 repo 連結（PR 同步與 webhook 尚未實作）
```

## 已決定的技術選擇

| 項目 | 選擇 | 原因 |
|---|---|---|
| 後端 | Python 3.12 + FastAPI | AI 相關套件完整；自動產生 OpenAPI 文件 |
| 套件管理 | uv | 速度快，`uv.lock` 讓所有人的環境一致 |
| 資料庫 | PostgreSQL（雲端使用 Supabase） | 免費額度足夠；需要時可直接啟用 pgvector |
| ORM 與遷移 | SQLAlchemy 2 + Alembic | 資料表變更寫成遷移檔放進 Git，由後端統一管理 |
| 登入 | Supabase Auth（GitHub 登入） | 登入流程不需自行實作；後端只驗證 JWT，之後要更換只改 `app/core/auth.py` |
| repo 資料 | GitHub App + webhook | 不依賴使用者的登入 token，成員沒有登入時進度也會同步 |
| LLM | OpenAI API（`gpt-4.1`） | 結構化輸出（pydantic）可直接驗證；文件量小，先將需要的資料直接帶入 prompt，不做向量檢索。服務層只依賴 `app/ai/llm.py` 的 `LlmClient`，要換模型只改這裡 |
| API 規格 | 以後端為準 | 後端實作穩定後，前端改用 `openapi-typescript` 由 OpenAPI 產生型別 |

## 資料夾責任

| 資料夾 | 負責內容 |
|---|---|
| `frontend/` | 畫面與互動；`VITE_USE_MOCK=true` 時用記憶體資料獨立運作 |
| `backend/app/api/routes/` | 解析請求、權限檢查、呼叫 services，每個檔案對應 contracts.ts 的一組服務 |
| `backend/app/schemas/` | API 的輸入輸出格式（Pydantic），對應 `frontend/src/types/` |
| `backend/app/services/` | 商業邏輯，可直接參考前端 mock 移植 |
| `backend/app/models/` | 資料表定義（SQLAlchemy） |
| `backend/app/ai/` | LLM 客戶端、稽核紀錄、各功能的 prompt |
| `backend/app/repo/` | 記憶體版資料層（過渡用）與種子資料 |
| `backend/app/integrations/github/` | GitHub App 與 webhook |
| `backend/alembic/` | 資料表遷移檔 |
| `docs/` | 架構說明與 API 對照表 |

## 尚未實作的設計

這些原本規劃的元件目前**沒有程式碼**（空殼已移除，避免誤導）。要實作時照下面的設計：

| 項目 | 設計 | 備註 |
|---|---|---|
| 檔案儲存 | Supabase Storage，bucket 名稱 `documents`（設定 `STORAGE_BUCKET`、`SUPABASE_SERVICE_ROLE_KEY` 已預留）；介面保持與 S3 類似（upload／download／delete），之後換服務只改實作 | 目前 `documents` 只存 metadata，`storage_path` 是預定位置，刪除資料列時要另外刪檔案 |
| 背景工作 | 文件解析、AI 拆解、驗收檢查等耗時工作放進佇列，前端查詢進度；Redis + RQ 或 arq | 目前 AI 呼叫在請求內同步等待（路由用同步函式，由 thread pool 執行），前端逾時放寬為 120 秒 |
| RAG／脈絡組裝 | 目前文件全文直接帶入 prompt（`DocSnippet`，見 `app/ai/context.py`）；要加入檢索時，只需要換掉取得片段的方式 | 資料庫映像檔已內建 pgvector |
| GitHub PR／commit 同步、webhook | 資料表已建（`github_pull_requests`、`github_commits`、`github_webhook_events`），規格見 [github.md](github.md)；PR 合併到預設 branch 時任務自動完成 | 階段 4，尚未開始 |
| 即時通知 | 目前前端每 60 秒輪詢 | |

## 開發順序建議

1. 資料表設計與登入：`models/`、`core/auth.py`
2. 專案、成員、Sprint、任務的 CRUD 與狀態流程，前端改為 `VITE_USE_MOCK=false` 可跑基本流程
3. 文件上傳（Supabase Storage，尚未實作）與脈絡組裝：`ai/context.py`
4. AI 功能：會議紀錄分析、任務拆解、指派建議、執行計畫、驗收檢查、專案脈絡助理
5. GitHub 整合、即時通知、部署

## 分工對應

| 角色 | 主要資料夾 |
|---|---|
| A：後端核心 | `models/`、`core/auth.py`、`services/`、`api/routes/`（tasks、sprints、members、workspace） |
| B：規劃階段 AI | `ai/`（analyze_minutes、story_assistant、decompose、suggest_assignee）、`api/routes/planning.py` |
| C：文件與執行階段 AI | `ai/context.py`、`ai/`（execution_plan、acceptance_check、context_chat） |
| D：前端整合與 DevOps | `frontend/`、`integrations/github/`、`.github/workflows/`、部署 |
