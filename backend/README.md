# Taskline 後端

Python 3.12 + FastAPI + SQLAlchemy 2 + Alembic，套件以 [uv](https://docs.astral.sh/uv/) 管理。

前端 `frontend/src/services/contracts.ts` 的每個方法都有對應的路由。**哪些已實作、資料來源是資料庫還是記憶體、是否需要登入，見 [docs/api-status.md](../docs/api-status.md)**；尚未實作的端點呼叫時回傳 `501 NOT_IMPLEMENTED`。出問題時從哪裡開始查，見 [docs/where-to-look.md](../docs/where-to-look.md)。

## 本機開發

需要 uv（`setup.sh` 會詢問後自動安裝），建議直接在根目錄執行 `./setup.sh` 完成初始化、`./dev.sh full` 啟動，說明見[根目錄 README](../README.md#腳本說明)。

```bash
# 第一次
curl -LsSf https://astral.sh/uv/install.sh | sh   # 安裝 uv（官方安裝程式，也可用 brew install uv 或 pipx install uv）
cp .env.example .env            # 依需要填入金鑰
uv sync                         # 自動安裝 Python 3.12 與所有套件

# 啟動本機資料庫（在 repo 根目錄；只用雲端 Supabase 時可略過）
docker compose up -d

# 啟動 API
uv run uvicorn app.main:app --reload    # http://localhost:8000
```

- API 文件：http://localhost:8000/docs
- 健康檢查：http://localhost:8000/api/health
- 前端要接上後端時，在 `frontend/.env.local` 設定 `VITE_USE_MOCK=false`
- 每個回應都有 `X-Request-Id` 標頭；500 錯誤訊息裡的「錯誤代碼」就是它，用來在後端日誌搜尋同一個請求

## 常用指令

```bash
uv run pytest                    # 測試（tests/db 需要先在根目錄 docker compose up -d，否則自動略過）
uv run ruff check .              # lint
uv run ruff format .             # 格式化
uv add <套件>                    # 新增套件（會更新 uv.lock，記得一起 commit）

# 資料表遷移
uv run alembic revision --autogenerate -m "說明"   # 依 app/models 產生遷移檔
uv run alembic upgrade head                        # 套用到資料庫
```

## 資料夾結構

```
backend/
├── app/
│   ├── main.py              FastAPI 進入點：middleware（request id、AI 稽核、CORS）、錯誤格式、掛載路由、/api/health
│   ├── api/
│   │   ├── deps.py          路由共用依賴（Db、ProjectId）；路由檔一律從這裡 import
│   │   └── routes/          路由，每個檔案對應 contracts.ts 的一組服務；只解析請求、檢查權限、呼叫 services
│   ├── core/
│   │   ├── config.py        設定（讀取 .env）
│   │   ├── errors.py        ApiError 與統一錯誤格式 {code, message}
│   │   ├── auth.py          JWT 驗證、CurrentMember、require_leader
│   │   └── observability.py request id 與請求日誌
│   ├── db/session.py        資料庫連線與 session
│   ├── models/              資料表定義（SQLAlchemy，28 張表）
│   ├── schemas/             API 輸入輸出格式，對應 frontend/src/types
│   ├── services/            商業邏輯。*_flow.py 讀寫記憶體（MemoryStore）；其餘多讀寫資料庫；*_ai.py／task_planning.py 是 AI 引擎
│   ├── repo/                記憶體版資料層（MemoryStore）與種子資料；Sprint、任務、規劃目前還在這裡
│   ├── ai/                  OpenAI 封裝（llm.py）、AI 稽核（audit.py）、prompts/、輸出格式（schemas.py）
│   └── integrations/github/ GitHub App（API 呼叫、安裝流程 state 簽章）
├── scripts/route_status.py  產生 docs/api-status.md
├── alembic/                 資料表遷移
├── tests/                   pytest（tests/db 需要本機 Postgres；tests/prompt_eval 需要 OpenAI 金鑰）
├── pyproject.toml           套件與 ruff、pytest 設定
├── uv.lock                  鎖定的套件版本
├── Dockerfile               部署用映像檔
└── .env.example             環境變數範本
```

## 實作慣例

- **欄位命名**：Python 使用 snake_case，API 輸出一律 camelCase（`schemas/base.py` 的 `ApiModel` 自動轉換），與前端型別一致
- **錯誤**：一律 `raise ApiError(訊息, status, code)`，前端會直接顯示訊息
- **權限**：在後端檢查，不能只靠前端隱藏。例如 Leader 限定的操作、Prompt 與對話僅限任務負責人
- **API 變更**：前端 `contracts.ts`、`services/http/index.ts` 與後端路由要一起修改，`tests/test_app.py` 會檢查兩邊端點一致；改完執行 `uv run python scripts/route_status.py` 更新 `docs/api-status.md`（`tests/test_api_status_doc.py` 會檢查）
- **AI 結果**：一律先存成草稿，由使用者確認後才生效
- **商業邏輯**：放在 `services/`，路由只負責解析請求與回應；前端 mock 的規則可直接當規格，對照表見 `docs/api.md`
