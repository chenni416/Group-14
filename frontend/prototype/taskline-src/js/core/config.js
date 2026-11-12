/* =========================================================
   領域、知識庫、模板
   ========================================================= */
const DOM={FE:{n:'前端',icon:'code'},BE:{n:'後端',icon:'db'},AI:{n:'AI',icon:'spark'},QA:{n:'QA',icon:'shield'},DS:{n:'設計',icon:'pen'}};
const KB={
  FE:'Coding Standards §2：React 18 + TypeScript strict，樣式使用 Tailwind；共用元件放在 /web/src/components，狀態管理用 Zustand。',
  BE:'API 規格 v2：所有端點需 JWT（Bearer）；錯誤格式 {code, message}；資料存取使用 SQLModel，資料表變更以 Alembic 遷移。',
  AI:'PRD §4：AI 輸出需為結構化 JSON（Epic → Story → Sub-task）；向量庫為 pgvector，模型與檢索參數設定見 /ai/config.py。',
  QA:'README §CI：GitHub Actions 於 PR 觸發 lint + unit + e2e；E2E 使用 Playwright，測試資料以 /scripts/seed.py 建立。',
  DS:'Figma UI Kit v2：卡片圓角 22/30px、主色 #131518、狀態色 orange / blue / purple；元件需提供 hover、focus、disabled 狀態。'};
const REF={FE:['/web/src/pages/','/web/src/components/'],BE:['/api/app/routers/','/api/app/models/'],AI:['/ai/pipelines/','/ai/config.py'],QA:['/e2e/','/.github/workflows/ci.yml'],DS:['Figma › Taskline UI Kit v2']};
const LIMIT={FE:'遵循本專案 React + TypeScript + Tailwind 架構，不新增 UI 套件',BE:'遵循本專案 FastAPI 與 SQLModel 架構，資料表變更需附 Alembic migration',AI:'使用既有 LangChain pipeline 與 pgvector，不直接呼叫未封裝的模型 API',QA:'測試需能在 CI 無頭模式執行，不依賴外部服務',DS:'沿用 UI Kit v2 tokens，不新增未定義的色彩'};
const GEN_AC={FE:['畫面與 Figma 一致，375px 手機寬度正常','具備載入、錯誤與空狀態'],BE:['API 有文件（輸入／輸出／錯誤碼）','關鍵路徑有單元測試且通過'],AI:['有固定測試集與評估指標','結果可重現（記錄參數與版本）'],QA:['涵蓋主要流程與至少一個例外流程','在 CI 上全數通過'],DS:['提供 Figma 元件並標註互動狀態','經一位前端成員確認可實作']};
const DOMTAGS={FE:['React','TypeScript'],BE:['FastAPI','PostgreSQL'],AI:['LLM','RAG'],QA:['Playwright'],DS:['Figma','Design System']};

const LIB=[
 {re:/左右分割|問專案|對話/,epic:'對話式 Prompt Studio',story:'成員能在任務內與 AI 釐清規格',subs:[
  {t:'任務詳情 Split View 介面（規格／對話）',d:'FE',tags:['React','TypeScript','Tailwind'],sp:3,why:'新版面＋對話元件，需處理串流訊息與 RWD',slug:'split-view',ac:['左側為任務規格與 Prompt 畫布，右側為對話區','對話訊息支援串流顯示與 Markdown','手機寬度改為上下排列']},
  {t:'專案脈絡對話 API（掛載知識庫 RAG）',d:'AI',tags:['LLM','RAG','Python'],sp:5,why:'需整合向量檢索與任務／Sprint 脈絡組裝，屬新服務',slug:'context-chat',ac:['每次對話自動帶入任務規格、Sprint Goal 與相關文件片段','回覆附上引用來源文件','單次回應延遲 p90 < 3 秒']}]},
 {re:/Prompt.*(更新|版本|還原)|版本/,epic:'對話式 Prompt Studio',story:'Prompt 會隨對話演進並可回溯',subs:[
  {t:'Prompt 版本紀錄與還原 API',d:'BE',tags:['FastAPI','PostgreSQL'],sp:3,why:'涉及新資料表 prompt_versions 與遷移',slug:'prompt-versions',ac:['每次對話更新產生新版本並記錄差異','可還原至任一歷史版本','API 有文件與單元測試']},
  {t:'Living Prompt 畫布（差異高亮、一鍵複製）',d:'FE',tags:['React','TypeScript'],sp:2,why:'延伸既有元件，主要為差異顯示',slug:'living-prompt',ac:['新增內容以高亮標示','一鍵複製到剪貼簿','顯示目前版本號並可切換']}]},
 {re:/三種模式|搶單|指定成員|Review.*模式/,epic:'Review 策略路由',story:'Leader 能依任務關鍵程度設定審核策略',subs:[
  {t:'Review Policy 設定元件（三種模式）',d:'FE',tags:['React','Tailwind'],sp:2,why:'表單元件＋條件欄位，無新 API',slug:'review-policy-ui',ac:['支援 Leader 專審／團隊搶單／指定成員','指定成員可設定需 1 人或全員同意','任務層級設定可覆蓋專案預設']},
  {t:'Review 路由與通知服務',d:'BE',tags:['FastAPI','PostgreSQL'],sp:5,why:'需設計審核狀態機與通知派發，涉及資料表更動',slug:'review-routing',ac:['依策略發送個人通知或推送公共池','Claim 具併發保護，同時只有一人認領成功','全員同意模式需全部核准才轉 Done']}]},
 {re:/In Review|誰在審|多久/,epic:'Review 策略路由',story:'看板能清楚呈現審核進度',subs:[
  {t:'In Review 卡片狀態視覺（專審／認領／計時）',d:'FE',tags:['React','Tailwind'],sp:2,why:'純前端呈現，依既有設計規範',slug:'review-card',ac:['專審卡片顯示黃色呼吸外框','開放認領卡片顯示 Claim Review 按鈕','已認領顯示審查人與經過時間']},
  {t:'Review 狀態視覺規範',d:'DS',tags:['Figma','Design System'],sp:1,why:'延伸既有元件庫',slug:'review-visual',ac:['定義三種審核狀態的色彩與動效','提供 Figma 元件與標註']}]},
 {re:/webhook|PR 開啟|GitHub PR/i,epic:'Review 策略路由',story:'PR 開啟時任務自動進入審核',subs:[
  {t:'GitHub PR Webhook 接收與簽章驗證',d:'BE',tags:['FastAPI','Docker'],sp:3,why:'外部事件需驗證 HMAC 簽章並處理重送',slug:'pr-webhook',ac:['驗證 X-Hub-Signature-256，失敗回傳 401','PR opened 時任務轉為 In Review 並套用審核策略','重複事件具冪等性']}]},
 {re:/通知|接受|協商/,epic:'認領與通知',story:'成員能確認或協商被指派的任務',subs:[
  {t:'Action Required Inbox（接受／協商）',d:'FE',tags:['React','TypeScript'],sp:3,why:'新頁面＋對話框，含狀態回饋',slug:'inbox',ac:['顯示指派人、點數與任務摘要','接受後狀態改為 Assigned','協商需填原因並可建議人選，退回 Leader']}]},
 {re:/E2E|測試/,epic:'品質保證',story:'關鍵流程具備自動化測試',subs:[
  {t:'E2E 測試：認領與 Review 流程',d:'QA',tags:['Playwright','GitHub Actions'],sp:3,why:'需建立多角色測試資料',slug:'e2e-review',ac:['涵蓋接受、協商退回與三種 Review 模式','在 CI 自動執行並全數通過']}]},
];
const SAMPLE=`# Sprint 3 規劃會議（11/09）
Sprint Goal：讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制

## 討論重點
- 任務詳情要改成左右分割，右邊是可以問專案問題的 AI 對話
- Prompt 要能隨對話更新，保留版本可以還原
- Review 要支援三種模式：Leader 專審、團隊搶單、指定成員
- 看板 In Review 卡片要顯示誰在審、審了多久
- 需要 GitHub PR webhook，PR 開啟時自動進 In Review
- 通知中心：成員可以接受或協商轉移
- E2E 測試涵蓋認領與 Review 流程`;

const ST={DRAFT:{n:'Draft · 手動',c:'gray'},AI_DRAFT:{n:'AI Suggestion',c:'purple'},PENDING_MEMBER:{n:'Leader Approved · 待確認',c:'amber'},RETURNED:{n:'協商退回',c:'red'},ASSIGNED:{n:'Member Accepted',c:'green'},TODO:{n:'To Do',c:'gray'},IN_PROGRESS:{n:'In Progress',c:'orange'},IN_REVIEW:{n:'In Review',c:'blue'},DONE:{n:'Done',c:'green'}};
const POL={leader:{n:'Leader 專審',en:'PO / Leader Only',d:'商業邏輯重大變更、資料庫遷移、架構核心調整'},pool:{n:'團隊搶單認領',en:'First-available / Peer Pool',d:'一般 CRUD、前端元件修飾、小型 Bug 修復'},target:{n:'指定成員 / 領域',en:'Targeted Specialist',d:'跨職能審核：請設計師看畫面、請維運審查部署'}};
