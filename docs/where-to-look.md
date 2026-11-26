# 出問題時先看哪裡

除錯或修改功能時，從這份文件找起點。檔案路徑都相對於 repo 根目錄。

## 1. 一個請求怎麼走

```
前端頁面 (frontend/src/features/*)
  └─ hooks/queries.ts 等 hooks（TanStack Query）
      └─ services/index.ts ── USE_MOCK=true ──▶ services/mock/ + mocks/（記憶體模擬，不會碰後端）
          │                    USE_MOCK=false
          └─ services/http/index.ts → http/client.ts（axios）
               帶上 Authorization: Bearer <Supabase token> 與 X-Project-Id
                    │
後端 backend/app/main.py  middleware 由外到內：RequestId → AI 稽核 → CORS
  └─ api/routes/<服務>.py        解析請求、檢查登入與 Leader（core/auth.py）
      └─ services/*              商業邏輯
          ├─ 資料庫版（projects、members、invitations、join_codes、notifications、documents、github_link）
          │     └─ models/ → db/session.py → Supabase（Postgres）
          ├─ 記憶體版（*_flow.py：Sprint、任務、規劃）
          │     └─ repo/memory.py（MemoryStore，全域、不分專案、重啟重置）＋ repo/seed.py
          └─ AI（*_ai.py、task_planning.py）→ ai/llm.py → OpenAI；提示詞在 ai/prompts/*.md
```

**判斷一個端點走哪條路：** 看 [api-status.md](api-status.md) 的「資料來源」欄。

## 2. 症狀 → 先看哪裡

| 症狀 | 可能原因與先看的地方 |
|---|---|
| **500，訊息有「錯誤代碼 xxxx」** | 在後端日誌搜尋 `rid=xxxx`，會有完整的例外與 traceback（`app/core/observability.py`）。每個回應都有 `X-Request-Id` 標頭，瀏覽器開發者工具的 Network 可以看到 |
| 登入後立刻被登出、一直 401 | `app/core/auth.py` 的 `verify_token`；錯誤碼 `TOKEN_EXPIRED`、`INVALID_TOKEN`、`AUTH_UNAVAILABLE`。確認 `backend/.env` 的 `SUPABASE_URL` 與前端是同一個專案（[auth.md](auth.md)）。前端收到 401 會自動登出（`frontend/src/services/http/client.ts`） |
| 403 `FORBIDDEN` | `core/auth.py` 的 `require_leader`：角色取自目前專案的 `project_members`。GitHub 連結的 Leader 檢查在 `services/github_link.py` |
| 404 `NO_PROJECT` | 你還沒有任何專案（`services/projects.py` 的 `current_membership`） |
| 403 `PROJECT_ACCESS_DENIED`、400 `INVALID_PROJECT_ID` | 前端送的 `X-Project-Id` 指向已刪除的專案、你已不是成員，或格式不是 uuid。**後端不會偷偷改用別的專案**。前端收到後會自動清掉目前專案、重新讀取並提示（`frontend/src/lib/projectRecovery.ts`、`app/providers.tsx`）。帳號層級的端點（`/me`、專案清單、邀請、通知）不檢查這個標頭，見 [api-status.md](api-status.md) 的「登入（帳號）」。目前專案存在 `frontend/src/stores/project.store.ts`（只有真正的 uuid 才會送出） |
| 501 `NOT_IMPLEMENTED` | 該端點還沒實作，見 [api-status.md](api-status.md) |
| 資料重啟後不見了、不同專案看到同一份資料 | 該端點用的是記憶體資料層（`app/repo/memory.py`），看 api-status 的「資料來源」 |
| `remaining connection slots`、`prepared statement ... does not exist` | `DATABASE_URL` 要用 port 6543（`app/db/session.py`、[database.md](database.md) 第 8 節） |
| `alembic upgrade` 失敗、`alembic heads` 出現兩行 | 遷移分岔或遷移檔不在 `main`（[database.md](database.md) 第 8 節）；遷移檔在 `backend/alembic/versions/` |
| AI 回傳怪異、數量對不上 | 開發環境開 `http://localhost:8000/api/dev/ai-logs/view`：每次呼叫的 prompt、模型原始輸出、程式丟棄或修正了什麼（`app/ai/audit.py`，檔案在 `backend/logs/ai-calls.jsonl`）。校正邏輯在 `services/task_planning.py`、`planning.py`、`sprint_ai.py` 等 `*_ai.py`；提示詞在 `app/ai/prompts/*.md`（改完要重啟後端） |
| AI 429／502／504、`AI_NOT_CONFIGURED` | `app/ai/llm.py` 的 `_to_api_error`；`backend/.env` 的 `OPENAI_API_KEY` |
| GitHub 連結失敗（`GITHUB_NOT_CONFIGURED`、`INVALID_STATE`、`INSTALLATION_NOT_YOURS`、`REPO_ALREADY_LINKED`） | `services/github_link.py`（流程與檢查）、`integrations/github/client.py`（呼叫 GitHub）、`integrations/github/state.py`（state 簽章，30 分鐘期限）；流程見 [github.md](github.md) 第 8 節 |
| 邀請、邀請碼、加入申請 | `services/invitations.py`、`services/join_codes.py`，路由 `api/routes/invitations.py`、`join_codes.py` |
| 通知少了或對不上 | 邀請類通知走資料庫（`services/notifications.py`），其他類型在記憶體（`MemoryStore.notify`）。前端 `components/layout/NotificationBell.tsx` 每 60 秒輪詢 |
| CORS 錯誤 | `app/main.py` 的 CORS 設定與 `CORS_ORIGINS`（`app/core/config.py`） |
| 前端畫面的資料「怪怪的」 | 先確認模式：`frontend/src/services/index.ts` 的 `USE_MOCK`（預設 `true`＝全部是前端模擬資料）；`dev.sh full` 才會連真實後端 |
| 前端打的端點後端沒有 | `backend/tests/test_app.py` 會比對 `frontend/src/services/http/index.ts` 與後端路由 |

## 3. 日誌長什麼樣

```
INFO  app.request  rid=3f9a1c2b7d40 GET /api/projects 200 18ms
INFO  app.request  rid=8d21e07c55aa GET /api/project 403 9ms        （PROJECT_ACCESS_DENIED：專案已不存在或不是成員）
WARNING app.request rid=ab12cd34ef56 POST /api/planning/drafts 502 4210ms
ERROR app.request rid=… POST … 未處理的例外        （後面接完整 traceback）
```

`/api/health` 與預檢請求（OPTIONS）只在出錯時才記錄。

## 4. 新增或修改一個 API 要改哪些地方

1. `frontend/src/services/contracts.ts`：介面
2. `frontend/src/services/http/index.ts`：真實後端的呼叫
3. `frontend/src/services/mock/*`：mock 實作（示範模式）
4. `backend/app/api/routes/<服務>.py`：路由，共用依賴從 `app/api/deps.py` import
5. `backend/app/schemas/`：輸入輸出格式；`frontend/src/types/`：對應的前端型別
6. `backend/app/services/`：商業邏輯
7. 有新資料表或欄位：`backend/app/models/` ＋ `alembic revision --autogenerate`（步驟見 [database.md](database.md) 第 7 節）
8. `backend/tests/`：測試
9. `cd backend && uv run python scripts/route_status.py`：更新 [api-status.md](api-status.md)（CI 會檢查）

## 5. 本機驗證（發 PR 前）

```bash
cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd frontend && npm run lint && npm run build
```

`backend/tests/db/` 需要本機 Docker 的 Postgres（`docker compose up -d`），沒有的話會自動略過，CI 一律執行。
