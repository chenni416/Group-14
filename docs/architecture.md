# 系統架構

## 整體架構

```
前端 React（frontend/）
   │  HTTPS，路徑與資料格式依 frontend/src/services/contracts.ts
後端 FastAPI（backend/）
   ├─ PostgreSQL ──────── 業務資料（本機 docker-compose；雲端 Supabase）
   ├─ Supabase Auth ───── GitHub 登入，後端只驗證 JWT
   ├─ Supabase Storage ── 上傳的會議紀錄、PRD 等文件
   ├─ 背景 worker ─────── 文件解析、AI 拆解、驗收檢查等耗時工作（Redis）
   ├─ Anthropic API ───── LLM
   └─ GitHub App ──────── webhook 同步 PR 狀態
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
| LLM | Anthropic API | 文件量小，先將需要的資料直接帶入 prompt，不做向量檢索；之後要加入 RAG 只需修改 `app/ai/context.py` |
| API 規格 | 以後端為準 | 後端實作穩定後，前端改用 `openapi-typescript` 由 OpenAPI 產生型別 |

## 資料夾責任

| 資料夾 | 負責內容 |
|---|---|
| `frontend/` | 畫面與互動；`VITE_USE_MOCK=true` 時用記憶體資料獨立運作 |
| `backend/app/api/routes/` | 解析請求、權限檢查、呼叫 services，每個檔案對應 contracts.ts 的一組服務 |
| `backend/app/schemas/` | API 的輸入輸出格式（Pydantic），對應 `frontend/src/types/` |
| `backend/app/services/` | 商業邏輯，可直接參考前端 mock 移植 |
| `backend/app/models/` | 資料表定義（SQLAlchemy） |
| `backend/app/ai/` | LLM 客戶端、脈絡組裝、各功能的 prompt |
| `backend/app/storage/` | 檔案儲存 |
| `backend/app/integrations/github/` | GitHub App 與 webhook |
| `backend/app/workers/` | 背景工作 |
| `backend/alembic/` | 資料表遷移檔 |
| `docs/` | 架構說明與 API 對照表 |

## 開發順序建議

1. 資料表設計與登入：`models/`、`core/auth.py`
2. 專案、成員、Sprint、任務的 CRUD 與狀態流程，前端改為 `VITE_USE_MOCK=false` 可跑基本流程
3. 文件上傳與脈絡組裝：`storage/`、`ai/context.py`
4. AI 功能：會議紀錄分析、任務拆解、指派建議、執行計畫、驗收檢查、專案脈絡助理
5. GitHub 整合、即時通知、部署

## 分工對應

| 角色 | 主要資料夾 |
|---|---|
| A：後端核心 | `models/`、`core/auth.py`、`services/`、`api/routes/`（tasks、sprints、members、workspace） |
| B：規劃階段 AI | `ai/`（analyze_minutes、story_assistant、decompose、suggest_assignee）、`api/routes/planning.py` |
| C：文件與執行階段 AI | `storage/`、`ai/context.py`、`ai/`（execution_plan、acceptance_check、living_prompt、context_chat）、`workers/` |
| D：前端整合與 DevOps | `frontend/`、`integrations/github/`、`.github/workflows/`、部署 |
