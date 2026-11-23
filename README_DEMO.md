# Taskline 展示版（`Group-14-demo` 分支）使用說明

這個分支可以在本機完整操作 **Sprint 規劃流程**，其中的 AI 功能會**真的呼叫 OpenAI**，每一次呼叫的提示詞、token、模型回傳都會被記錄下來，可以在瀏覽器查看。

> 專案整體的環境建置（Docker、資料庫、Supabase 等）請看 [README.md](README.md)。這份文件只說明展示版：**不需要 Docker、資料庫、Supabase，也不需要 GitHub 登入**。

## 目錄

1. [這個分支有什麼](#1-這個分支有什麼)
2. [第一次設定](#2-第一次設定)
3. [加入你自己的 OpenAI API Key](#3-加入你自己的-openai-api-key)
4. [啟動與重新啟動](#4-啟動與重新啟動)
5. [操作網頁：Sprint 規劃流程](#5-操作網頁sprint-規劃流程)
6. [查看 AI 呼叫紀錄](#6-查看-ai-呼叫紀錄)
7. [清除資料、重新開始](#7-清除資料重新開始)
8. [設定一覽](#8-設定一覽)
9. [常見問題](#9-常見問題)
10. [目前的限制](#10-目前的限制)

---

## 1. 這個分支有什麼

| 項目 | 說明 |
|---|---|
| 登入 | 沒有。後端沒帶登入資訊時，一律以 Leader（陳怡君）身分處理 |
| 資料 | 存在後端的**記憶體**（假資料）。後端重啟就回到初始狀態：只有進行中的 Sprint 2 |
| AI | 呼叫 OpenAI（預設模型 `gpt-4.1`）：切 Story、拆 Task、指派建議、Story 助理對話、待釐清問題等 |
| AI 呼叫紀錄 | 每次呼叫都記錄，可在瀏覽器查看（見[第 6 節](#6-查看-ai-呼叫紀錄)） |
| 網頁 | 規劃流程（建立 Sprint → AI 分析 → 確認 Story → Task 拆解與派工 → 核准派工）可以連後端操作 |

這個分支是尚未合併 main 的 GitHub 登入（PR #11）之前的版本，再加上規劃流程路由與 AI 呼叫紀錄，所以**沒有** Supabase 登入。已合併最新 main、使用真實登入的版本在 `feat/backend-ai-openai`（PR #16）。

---

## 2. 第一次設定

### 需要的工具
- Git、Node.js 22 以上
- 後端：[uv](https://docs.astral.sh/uv/)（會自動安裝 Python 3.12）
- 一組 OpenAI API Key（見[第 3 節](#3-加入你自己的-openai-api-key)）

### 步驟

```bash
git clone https://github.com/chenni416/Group-14.git
cd Group-14
git switch Group-14-demo

# 後端
cd backend
cp .env.example .env        # Windows PowerShell：copy .env.example .env
uv sync

# 前端
cd ../frontend
npm install
```

### 前端連後端的設定（建議做一次，之後不用每次打參數）
在 `frontend/` 建立 **`.env.local`**（這個檔案不會被 commit）：

```
VITE_USE_MOCK=false
VITE_API_URL=http://127.0.0.1:8000/api
```

這兩行的意思：不要用前端內建的假資料，改打後端。**沒有設定的話網頁就是模擬模式，不會呼叫後端，也不會有 AI 紀錄。**

---

## 3. 加入你自己的 OpenAI API Key

### 取得金鑰
1. 登入 [platform.openai.com](https://platform.openai.com)，到 **API keys** 建立一組新的金鑰（`sk-` 開頭）。
2. 到 **Billing** 儲值，並建議設定**每月花費上限**，避免測試時意外超支。

### 填進後端
編輯 **`backend/.env`**，找到這一行並貼上你的金鑰（等號兩邊不要有空格、不要加引號）：

```
OPENAI_API_KEY=sk-你的金鑰
```

存檔後**重新啟動後端**才會生效（設定只在啟動時讀取）。

### 注意事項
- 金鑰**只能放在 `backend/.env`**。這個檔案已被 `.gitignore` 排除，**不要貼進程式碼、文件、PR 或聊天**。
- 每個人用自己的金鑰，不要共用同一組。
- 如果金鑰不小心外流，請立刻到 OpenAI 後台刪除並重新建立。
- 沒有填金鑰時，按任何 AI 按鈕都會失敗，錯誤是 `503 AI_NOT_CONFIGURED`（「尚未設定 OPENAI_API_KEY」）。
- 想換模型，修改 `OPENAI_MODEL`（預設 `gpt-4.1`）。換成不支援 temperature 的模型（例如推理模型）時，把 `OPENAI_TEMPERATURE=` 與 `OPENAI_TEXT_TEMPERATURE=` 都設成空值。

### 大概會用多少 token
這是實測的數字（每次視輸入長短而不同），可以用來估費用：

| 操作 | 模型呼叫 | token（約） | 等待時間 |
|---|---|---|---|
| 切 Story | 1 次 | 4,000 | 3 到 9 秒 |
| Task 拆解（拆 Task + 指派） | 2 次 | 7,000 | 15 到 25 秒 |
| Sprint 拆解（`decompose`，一次做完整個流程） | 4 次 | 16,000 | 25 秒以上 |
| 分析待釐清問題、Story 助理對話 | 1 次 | 2,000 | 1 到 3 秒 |

---

## 4. 啟動與重新啟動

需要**兩個終端機**：一個跑後端、一個跑前端。

### 後端（終端機 1）

```bash
cd backend
uv run uvicorn app.main:app --port 8000
```

看到 `Application startup complete` 就成功了。驗證：打開 <http://127.0.0.1:8000/api/health>，應該顯示 `{"status":"ok","env":"development"}`。

- **一定要在 `backend/` 資料夾裡啟動**。設定檔（`.env`）和紀錄檔（`logs/`）都是以目前所在的資料夾為基準。
- 後端的 API 文件：<http://127.0.0.1:8000/docs>

> **Windows 如果被「應用程式控制」擋住**（`uv run` 時出現 DLL 被封鎖的錯誤）：改在 WSL 裡跑。在 WSL 建立一個 Python 3.12 虛擬環境，裝好套件後執行：
> ```bash
> cd "/mnt/c/.../Group-14/backend"        # 換成你的專案路徑
> ~/你的venv/bin/python -m uvicorn app.main:app --port 8000 --host 127.0.0.1
> ```
> 套件清單見 `backend/pyproject.toml`。

### 前端（終端機 2）

```bash
cd frontend          # 一定要先進到 frontend 資料夾，在專案根目錄執行會找不到 package.json
npm run dev
```

看終端機顯示的網址，通常是 **<http://localhost:5173>**。如果是 5174 之類，表示 5173 已經有別的前端在跑，把舊的關掉比較不會搞混。

不想建立 `.env.local` 的話，也可以每次帶參數：

| | 指令 |
|---|---|
| Git Bash／macOS／Linux | `VITE_USE_MOCK=false VITE_API_URL=http://127.0.0.1:8000/api npm run dev` |
| PowerShell | `$env:VITE_USE_MOCK="false"; $env:VITE_API_URL="http://127.0.0.1:8000/api"; npm run dev` |

### 重新啟動

| 想做的事 | 做法 |
|---|---|
| **重啟後端**（改了 `.env`、改了程式、想清資料） | 在後端終端機按 `Ctrl+C`，再執行一次啟動指令 |
| **重啟前端**（改了 `.env.local`） | 在前端終端機按 `Ctrl+C`，再 `npm run dev` |
| **修改提示詞**（`backend/app/ai/prompts/*.md`） | 必須重啟後端，提示詞有快取，不重啟不會讀到新內容 |
| 只改前端程式 | 不用重啟，存檔後瀏覽器會自動更新 |

---

## 5. 操作網頁：Sprint 規劃流程

打開 <http://localhost:5173/sprints/planning>。頁面上方的步驟列是：

**建立 Sprint → 1 上輪 Sprint 統整 → 2 開啟 Sprint 與設定 → 3 Story 分析確認 → 4 Task 拆解與派工 → 5 派工總覽與發送**

`.env.example` 已設定 `SEED_PLANNING_SPRINT=false`（後端不預建 Sprint 3），所以從頭開始：

1. **上輪 Sprint 統整**：看 Sprint 2 的完成狀況，逐項決定未完成任務要「帶入本輪」或「延後」（也可按「全部帶入」「全部延後」）；對「延續事項」選擇「納入本輪」「繼續保留」或「移除」。納入的延續事項會自動寫進會議紀錄。
2. **建立 Sprint 3**：確認名稱、日期、每位成員的點數上限（Capacity）和 Sprint 目標。會議紀錄可以按「**範例會議紀錄**」帶入，也可以貼上自己的內容。
3. **AI 分析會議紀錄**：AI 會切出 Story，並提出待釐清的問題。逐題回答、確認 Story 的範疇與點數。
4. **Task 拆解與派工**：AI 把每個 Story 拆成 Task，並依領域、技能與負載建議負責人。可以調整點數、驗收條件、負責人，也可以延後或手動新增 Task。
5. **核准派工**：系統先做「核准前檢查」（有人超過點數上限、Task 缺負責人或驗收條件、還有待釐清問題未回答，都會被擋下並說明原因）。通過後，Task 進入「待成員確認」，成員收到派工邀請。

**等待 AI 時畫面會顯示進度，不是當機。** Task 拆解最久，約 15 到 25 秒。

---

## 6. 查看 AI 呼叫紀錄

每一次呼叫 OpenAI 的 API 請求，後端都會寫下一筆**完整紀錄**。

### 在瀏覽器查看（建議）

<http://127.0.0.1:8000/api/dev/ai-logs/view>

在網頁上操作 AI 按鈕後，**重新整理這個頁面**即可看到新紀錄（新的在最上面）。可以加 `?limit=5` 只看最近幾筆。

每筆紀錄是一張卡片，依處理順序：

| 區塊 | 內容 |
|---|---|
| 標題列 | 呼叫的 API、狀態碼、時間、身分、呼叫幾次、token 總數、總耗時、程式修正幾項 |
| ① 前端送來的請求 | 網頁送給後端的內容 |
| ② 第 N 次呼叫模型 | 模型、temperature、輸出格式、token（進／出／共）、耗時、結束原因；點開可看**提示詞（system）**、**送給模型的資料（user）**，以及**模型原始回傳** |
| ③ 程式的捨棄與修正 | 程式對模型輸出做了什麼，例如「捨棄編造的來源行號」「移除循環相依」「超出 capacity，已在理由註明」。沒有修正時會顯示「沒有捨棄或修正任何內容」 |
| ④ 回給網頁的內容 | API 實際回傳的內容（網頁收到的就是這份） |

### 其他查看方式
- **原始 JSON**：<http://127.0.0.1:8000/api/dev/ai-logs>（可加 `?limit=`）
- **檔案**：`backend/logs/ai-calls.jsonl`，每個請求一行 JSON，可以用任何文字編輯器或 `jq` 處理。後端重啟不會清掉這個檔案。

### 關於紀錄
- 只有**真的呼叫了模型**的請求才會記錄；不呼叫 AI 的操作（例如回答問題、調整點數）不會有紀錄。
- 網頁如果是**模擬模式**（沒有設 `VITE_USE_MOCK=false`），不會呼叫後端，所以不會有紀錄。
- 紀錄裡有**會議紀錄全文與完整提示詞**，屬於使用者資料。`backend/logs/` 已被 `.gitignore` 排除，**不要提交或分享這個檔案**。
- 這兩個查詢網址只在 `APP_ENV=development`（預設值）時存在，其他環境不會開放。
- 想關閉記錄：在 `backend/.env` 加上 `AI_LOG_PATH=`（留空），重啟後端。

---

## 7. 清除資料、重新開始

| 想做的事 | 做法 |
|---|---|
| **刪除目前的 Sprint 3，重新開始** | 重啟後端（資料在記憶體，會回到只有 Sprint 2 的初始狀態），**再把網頁重新整理一次**（`Ctrl+Shift+R`）清掉畫面上的草稿 |
| 清掉 AI 呼叫紀錄 | 刪除 `backend/logs/ai-calls.jsonl`（不需要重啟） |
| 後端啟動就預先建好 Sprint 3（直接從 Story 分析開始） | 在 `backend/.env` 把 `SEED_PLANNING_SPRINT` 改成 `true` 或刪掉這行，重啟後端 |

---

## 8. 設定一覽

所有設定都在 `backend/.env`（範本是 `backend/.env.example`），修改後要重啟後端。

| 設定 | 預設 | 說明 |
|---|---|---|
| `OPENAI_API_KEY` | （空） | **必填**，沒有的話 AI 功能全部無法使用 |
| `OPENAI_MODEL` | `gpt-4.1` | 使用的模型 |
| `OPENAI_TEMPERATURE` | `0.2` | 結構化輸出（切 Story、拆 Task、指派等）的取樣溫度，越低越穩定 |
| `OPENAI_TEXT_TEMPERATURE` | `0.5` | 純文字對話（Story 助理）的取樣溫度 |
| `APP_ENV` | `development` | 要保持 `development`：開發用的 AI 紀錄查詢網址與預設 Leader 身分都依賴它 |
| `SEED_PLANNING_SPRINT` | 程式預設 `true`；`.env.example` 已設為 `false` | `false`：從「建立 Sprint」開始；`true`：後端啟動就有規劃中的 Sprint 3 |
| `AI_LOG_PATH` | `logs/ai-calls.jsonl` | AI 紀錄檔位置（相對於 `backend/`）；留空即不記錄 |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:5175"]` | 允許呼叫後端的網頁網址。**開發環境（`APP_ENV=development`）本機的任何埠都會自動放行**（`localhost` 與 `127.0.0.1`，例如 Vite 自動換成 5174），不用改這裡；只有從**別台電腦或區網 IP** 開網頁時，才需要把那個網址加進來，例如 `["http://localhost:5173","http://192.168.1.5:5173"]` |

`.env` 裡的 `DATABASE_URL`、`SUPABASE_*`、`ANTHROPIC_*`、`REDIS_URL`、`GITHUB_*` 在展示版**用不到**，可以不管。

前端（`frontend/.env.local`）：

| 設定 | 說明 |
|---|---|
| `VITE_USE_MOCK` | `false`：連後端；沒設或 `true`：模擬模式（不呼叫後端） |
| `VITE_API_URL` | 後端 API 網址，連後端時必填，例如 `http://127.0.0.1:8000/api` |
| `VITE_AI_BACKEND` | 設成 `true`（並保持 `VITE_USE_MOCK=true`）：畫面與資料用前端假資料，只有 Planning Studio 的 3 個 AI 呼叫（切 Story、Story 助理、拆 Task）改打真實後端 |

---

## 9. 常見問題

| 狀況 | 原因與處理 |
|---|---|
| `npm error ... package.json` | 沒有先 `cd frontend` |
| 網頁一直是同樣的假資料，後端也沒有任何紀錄 | 前端是模擬模式。確認 `frontend/.env.local` 有設定，並重啟前端 |
| 前端網址是 5174，不是 5173 | 5173 已被占用，Vite 自動換埠。後端會自動放行本機的任何埠，功能不受影響；但建議關掉舊的前端，避免開錯 |
| 按 AI 按鈕出現 **503**（`AI_NOT_CONFIGURED`） | `backend/.env` 的 `OPENAI_API_KEY` 沒填，或填完沒有重啟後端 |
| 出現 **429**（`AI_RATE_LIMITED`） | OpenAI 限流或額度不足，檢查帳號的儲值與用量，稍後再試 |
| 出現 **504**（`AI_TIMEOUT`）或 **502**（`AI_UNAVAILABLE`） | OpenAI 逾時或暫時無法使用；紀錄頁卡片的錯誤欄位會有詳細訊息，重試即可 |
| 出現 **422**（`AI_REFUSED`） | 模型拒絕處理這份內容，調整會議紀錄後再試 |
| 出現 **502**（`AI_BAD_OUTPUT`） | 模型回傳的格式不正確，重試；紀錄頁可以看模型實際回了什麼 |
| 前端出現 Network Error | 後端沒有啟動，或 `VITE_API_URL` 設錯 |
| 前端出現 CORS 錯誤（後端日誌看到 `OPTIONS ... 400 Bad Request`） | 網頁網址不被允許。本機（`localhost`／`127.0.0.1` 任何埠）在開發環境會自動放行，所以通常是**從別台電腦或區網 IP 開網頁**，或 `APP_ENV` 不是 `development`。把網頁的完整網址加進 `CORS_ORIGINS` 並重啟後端 |
| 紀錄頁打不開（404） | `APP_ENV` 不是 `development` |
| 紀錄頁打開但沒有紀錄 | 還沒呼叫過 AI，或前端是模擬模式；也確認後端是在 `backend/` 資料夾啟動的 |
| 核准派工被擋下（422） | 看訊息：通常是某位成員超過點數上限（例如 `陳怡君 超過點數上限（10/8）`），把 Task 改派給別人或調低點數再核准 |
| 按「範例會議紀錄」沒反應 | 後端沒有啟動或版本不是這個分支 |
| 改了提示詞沒有變化 | 提示詞有快取，重啟後端 |
| 沒有「刪除 Sprint」按鈕 | 目前沒有這個功能，重啟後端即可（見[第 7 節](#7-清除資料重新開始)） |

---

## 10. 目前的限制

- **資料存在記憶體**：後端重啟就回到初始狀態，不會存進資料庫。
- **沒有登入**，且無法切換身分：畫面右上角的切換身分不能用（後端尚未實作），所有操作都以 Leader 身分進行。需要用其他成員身分呼叫 API 時，在 <http://127.0.0.1:8000/docs> 的請求加上 `X-Demo-User: m3`（`m1` 到 `m5` 是假資料裡的成員）。
- **規劃流程以外的功能還沒實作**：成員接受或協商派工、認領、執行計畫、驗收、問題回報、提案、回顧等路由回 `501`，進到那些頁面會看到「尚未實作」。
- **指派可能讓個人超過點數上限**：AI 偏好把同領域的任務都給同一個人，程式只會在理由後標註「超出 capacity」，核准前檢查會擋下，需要 Leader 手動改派。
- **AI 結果每次可能不同**，品質取決於模型與會議紀錄的內容；AI 產生的內容一律是草稿，要 Leader 確認才生效。

---

## 附錄：AI 功能的程式位置（給要改的人）

| 想改什麼 | 位置 |
|---|---|
| 提示詞 | `backend/app/ai/prompts/*.md`（說明見該資料夾的 `README.md`），改完要重啟後端 |
| 模型回傳的格式（schema） | `backend/app/ai/schemas.py` |
| 呼叫 OpenAI 與錯誤處理 | `backend/app/ai/llm.py` |
| AI 結果的後處理（捨棄與修正） | `backend/app/services/`：`planning.py`、`task_planning.py`、`assignment.py` 等 |
| AI 呼叫紀錄 | `backend/app/ai/audit.py`（寫入）、`backend/app/ai/audit_view.py`（網頁版） |
| 規劃流程的資料路由 | `backend/app/services/workspace_flow.py`、`sprint_flow.py`、`task_edit_flow.py` |
| 測試 | `backend/tests/`：`uv run pytest`（不需要 OpenAI 金鑰，也不會呼叫 OpenAI） |
| 提示詞評測（會呼叫 OpenAI） | `backend/tests/prompt_eval/`，說明見該資料夾的 `README.md` |
