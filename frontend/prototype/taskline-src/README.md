# taskline 前端原型

純 HTML / CSS / JavaScript，不需要安裝或建置。直接用瀏覽器開啟 `index.html` 即可（也可以用 VS Code 的 Live Server）。

## 資料夾結構

```
taskline-src/
├── index.html              頁面骨架：header、側欄、modal 容器，以及 CSS / JS 載入順序
├── css/
│   ├── base.css            :root 色彩與字型 tokens、外框、按鈕、卡片、標籤、表單、modal/toast
│   ├── pages.css           各頁面專屬樣式（dashboard、team/onboard、planning、inbox、board、studio）
│   └── responsive.css      平板 / 手機版面（需最後載入）
└── js/
    ├── core/
    │   ├── utils.js        時間、$ 選擇器、跳脫字元、圖示 IC 與 ic()
    │   ├── config.js       領域、知識庫片段、AI 拆解模板 LIB、範例會議紀錄、狀態與 Review 策略定義
    │   ├── state.js        全域狀態 S（成員、文件、Sprint…）與 seed() 示範資料
    │   ├── ai.js           decompose() 拆解、rankFor()/suggestAll() 推薦指派、promptText()、aiReply()
    │   └── workflow.js     通知、送審路由 sendToReview()、canReview()、Sprint 是否可啟動
    ├── ui/
    │   ├── components.js   共用小元件（頭像、狀態 chip、AI 標籤）、header / 側欄、render()
    │   └── modal.js        modal、toast、複製到剪貼簿、流程說明
    ├── views/              每個頁面一個檔案，回傳該頁 HTML 字串
    │   ├── dashboard.js    Project Dashboard（圓環圖、Burndown、Review 佇列）
    │   ├── team.js         ① 組織與團隊設定
    │   ├── onboard.js      ② 專案初始化與知識庫
    │   ├── planning.js     ③ Sprint Planning Studio（AI 拆解與審核）
    │   ├── inbox.js        ④ 確認與認領收件匣
    │   ├── board.js        ⑤ Active Board
    │   └── studio.js       任務詳情（Living Prompt + AI 對話 + Review Policy）
    ├── actions.js          所有按鈕動作 A：HTML 裡的 data-a="xxx" 會呼叫 A.xxx()
    ├── events.js           事件監聽、上傳文件、搜尋
    └── main.js             頁面對應表 VIEW 與初始化（最後載入）
```

## 常見修改

| 想改什麼 | 去哪裡 |
|---|---|
| 主色、字型、圓角 | `css/base.css` 最上面的 `:root` |
| 成員、Sprint、知識庫文件 | `js/core/state.js` 的 `S` |
| 初始任務與通知 | `js/core/state.js` 的 `seed()` |
| 範例會議紀錄、AI 拆解模板 | `js/core/config.js` 的 `SAMPLE`、`LIB` |
| 推薦指派的計分權重 | `js/core/ai.js` 的 `rankFor()` |
| 改某一頁的畫面 | `js/views/` 對應檔案 |
| 新增按鈕行為 | HTML 加 `data-a="名稱"`，在 `js/actions.js` 的 `A` 加同名函式 |

## 新增一個頁面

1. 在 `js/views/` 新增 `xxx.js`，寫一個 `function vXxx(){ return '...HTML...'; }`
2. 在 `index.html` 的 `main.js` 之前加上 `<script src="js/views/xxx.js"></script>`
3. 在 `js/main.js` 的 `VIEW` 加上 `xxx: vXxx`
4. 想出現在側欄或上方流程列，修改 `js/ui/components.js` 的 `SIDE` 或 `FLOW`

## 注意

- 這些 JS 是一般 `<script>`（不是 ES module），檔案之間共用全域變數，所以 **`index.html` 裡的載入順序不能亂調**。這樣做的好處是直接雙擊 `index.html` 就能執行。
- 資料只存在瀏覽器記憶體，重新整理會回到示範資料。
- AI 拆解、對話回覆目前是規則模擬，之後接後端時主要替換 `js/core/ai.js` 的 `decompose()` 與 `aiReply()`。
