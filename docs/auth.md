# GitHub 登入（Supabase Auth）

## 流程

```
前端 /login ──按下「以 GitHub 登入」──▶ Supabase ──▶ GitHub 授權頁
                                                       │ 使用者同意
前端 /auth/callback ◀── Supabase（建立 session）◀──────┘
   │ 取得 access token，之後每個 API 請求帶上 Authorization: Bearer <token>
後端 app/core/auth.py 驗證 token（簽章、有效期限、發行者、對象）
```

- 前端只在 `VITE_USE_MOCK=false` 時使用真正的登入；mock 模式維持假登入與身分切換
- 後端不處理 OAuth，只驗證 Supabase 簽發的 token
- 所有 GitHub 帳號都可以登入；第一次呼叫 `/api/me` 時在 `members` 資料表建立成員，之後同步 GitHub 帳號名稱、頭像與 email（以 GitHub id 比對）
- 顯示名稱預設為 GitHub 帳號名稱，可在設定頁修改（`PATCH /api/me`），登入時不會被覆蓋
- 專案內的角色、職稱、領域、容量在專案功能完成前先回傳預設值（角色為 Member）

## 設定（團隊只需要做一次）

1. **Supabase**：Authentication → Sign In / Providers → GitHub，複製 Callback URL
2. **GitHub**：Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL：`http://localhost:5173`
   - Authorization callback URL：貼上第 1 步的 Callback URL
   - 建立後產生 Client Secret
3. **Supabase**：回到 GitHub provider，開啟並填入 Client ID 與 Client Secret，**記得按儲存**
4. **Supabase**：Authentication → URL Configuration
   - Site URL：`http://localhost:5173`
   - Redirect URLs：`http://localhost:5173/auth/callback`、`http://localhost:5174/auth/callback`、`http://localhost:5175/auth/callback`

## 個人設定

在根目錄執行 `./setup.sh` 會逐一詢問並寫入下列欄位；也可以手動填寫：

| 檔案 | 欄位 | 來源 |
|---|---|---|
| `frontend/.env.local` | `VITE_USE_MOCK=false` | 手動啟動時才需要；`./dev.sh full` 會自動設定 |
| | `VITE_SUPABASE_URL` | Project Settings → API Keys 的 Project URL |
| | `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys 的 publishable key |
| `backend/.env` | `SUPABASE_URL` | 同上 Project URL |
| | `SUPABASE_JWT_SECRET` | 專案使用新的 JWT Signing Keys（目前是 ES256）時留空 |

## 測試

```bash
./dev.sh full
```

打開 http://localhost:5173 ，應該會被導向登入頁；登入後右上角顯示 GitHub 名稱與頭像。
其他頁面的資料 API 尚未實作，會顯示「尚未實作」，屬於正常狀況。

## 常見問題

| 狀況 | 原因 |
|---|---|
| 跳轉後顯示 `Unsupported provider: provider is not enabled` | Supabase 的 GitHub provider 沒有開啟或沒有儲存，或設定在別的 Supabase 專案 |
| GitHub 顯示 redirect_uri 不符 | GitHub OAuth App 的 callback URL 與 Supabase 的 Callback URL 不一致 |
| 登入後回到 Site URL 而不是 `/auth/callback` | 前端的 port 沒有加入 Supabase 的 Redirect URLs |
| 登入後立刻被登出 | 後端驗證失敗：確認 `backend/.env` 的 `SUPABASE_URL` 與前端是同一個專案，並重新啟動後端 |
| 登入頁顯示「尚未設定 Supabase」 | `frontend/.env.local` 缺少 Supabase 欄位，填好後重新執行 `npm run dev` |
