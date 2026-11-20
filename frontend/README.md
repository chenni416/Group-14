# Taskline 前端

React 18 + TypeScript + Vite + Tailwind CSS。預設使用 `src/mocks` 的記憶體資料運作（mock 模式），完整涵蓋 Sprint 規劃、派工、執行、審查與回顧流程；後端在 `../backend`。

## 開發

需要 Node.js 22 以上，完整的環境建置步驟見[根目錄 README](../README.md#環境建置)。

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc 型別檢查 + 產出 dist/
npm run typecheck  # 只做型別檢查
npm run lint
```

環境變數見 `.env.example`，個人設定放在 `.env.local`（不會 commit）：

| 變數 | 說明 |
|---|---|
| `VITE_USE_MOCK` | 預設 `true` 使用 mock；`false` 改呼叫真實後端 |
| `VITE_API_URL` | 後端位址，預設 `http://localhost:8000/api` |

> Mock 資料只存在記憶體，重新整理頁面會回到初始示範資料。

## 資料夾結構

```
src/
├── app/            router（各頁面 lazy-load）、providers（TanStack Query）
├── components/
│   ├── ui/         Button、Card、SegmentedControl、Badge、Modal 等共用元件
│   ├── layout/     AppShell、SideNav、TopBar、搜尋、身分切換
│   └── domain/     跨頁共用的業務元件（狀態流程、協商對話框）
├── features/       auth / dashboard / board / planning / sprints / inbox / task-studio / team / settings / onboarding
├── services/
│   ├── contracts.ts  前後端 API 介面（UI 只依賴這裡）
│   ├── mock/         mock 實作
│   └── http/         Axios 實作（REST 端點與 JWT 攔截器，路徑與後端一致）
├── mocks/          示範資料與規則式模擬邏輯（AI 拆解、指派推薦、Review 路由）
├── hooks/          共用 query / mutation hooks
├── stores/         Zustand：僅存 UI 狀態（篩選、Toast）
├── types/          領域型別
└── lib/            cn、常數、權限判斷、格式化
```

## 串接後端

後端（`../backend`）已依 `services/contracts.ts` 定義所有端點，路徑與 `services/http/index.ts` 一致，目前回傳 `501`，由各負責人逐步實作。

1. 啟動後端（見 `../backend/README.md`），API 文件在 http://localhost:8000/docs
2. 在 `.env.local` 設定 `VITE_USE_MOCK=false`
3. UI 元件與 hooks 不需修改；資料型別若有差異，調整 `src/types/` 即可

修改 API 時，`contracts.ts`、`services/http/index.ts` 與後端路由要一起更新；後端測試會檢查兩邊的端點一致。前後端對照表見 `../docs/api.md`。

`src/mocks/` 的規則式邏輯（派工、帶入、超載檢查、AI 模擬等）是後端實作的參考規格，後端完成前請保留。

## 設計規範

- 最外層畫布（`body`）為四角對角漸層：左上與右下暖杏橘 `#F4B48A`、右上與左下霧藍 `#93ABBD`、中央米灰 `#ECE7E2`，這是唯一允許漸層的地方；主容器白色 `rounded-3xl`，卡片白底 `border-gray-100`。
- 主色黑白灰（`#111827`）；橘 `#F97316`、天藍 `#0EA5E9`、紫 `#8B5CF6` 只用於圖表、進度條、狀態標籤。
- 互動只用 `transition-colors duration-150`；不使用 emoji、漸層、毛玻璃、發光與重陰影。
- 數字一律 `tabular-nums`；Icon 統一使用 Lucide 細線條。
