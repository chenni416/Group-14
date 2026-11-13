# Taskline 前端

React 18 + TypeScript + Vite + Tailwind CSS。目前使用 `src/mocks` 的記憶體資料渲染畫面，尚未串接後端。

## 開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc 型別檢查 + 產出 dist/
npm run lint
```

環境變數見 `.env.example`：`VITE_USE_MOCK=false` 時改呼叫 `VITE_API_URL` 的真實後端。

> Mock 資料只存在記憶體，重新整理頁面會回到初始示範資料。

## 資料夾結構

```
src/
├── app/            router（各頁面 lazy-load）、providers（TanStack Query）
├── components/
│   ├── ui/         Button、Card、SegmentedControl、Badge、Modal 等共用元件
│   ├── layout/     AppShell、SideNav、TopBar、搜尋、身分切換
│   └── domain/     跨頁共用的業務元件（狀態流程、協商對話框）
├── features/       dashboard / board / planning / inbox / team / onboarding / task-studio
├── services/
│   ├── contracts.ts  前後端 API 介面（UI 只依賴這裡）
│   ├── mock/         mock 實作
│   └── http/         Axios 實作（預留 REST 端點與 JWT 攔截器）
├── mocks/          示範資料與規則式模擬邏輯（AI 拆解、指派推薦、Review 路由）
├── hooks/          共用 query / mutation hooks
├── stores/         Zustand：僅存 UI 狀態（篩選、Toast）
├── types/          領域型別
└── lib/            cn、常數、權限判斷、格式化
```

## 串接後端

1. 依後端 OpenAPI 調整 `src/services/http/index.ts` 的端點。
2. 設定 `VITE_USE_MOCK=false`。
3. UI 元件與 hooks 不需修改；資料型別若有差異，調整 `src/types/` 即可。

## 設計規範

- 最外層畫布（`body`）為四角對角漸層：左上與右下暖杏橘 `#F4B48A`、右上與左下霧藍 `#93ABBD`、中央米灰 `#ECE7E2`，這是唯一允許漸層的地方；主容器白色 `rounded-3xl`，卡片白底 `border-gray-100`。
- 主色黑白灰（`#111827`）；橘 `#F97316`、天藍 `#0EA5E9`、紫 `#8B5CF6` 只用於圖表、進度條、狀態標籤。
- 互動只用 `transition-colors duration-150`；不使用 emoji、漸層、毛玻璃、發光與重陰影。
- 數字一律 `tabular-nums`；Icon 統一使用 Lucide 細線條。
