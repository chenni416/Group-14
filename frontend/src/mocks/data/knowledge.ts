import type { Domain } from '@/types';

/** 各領域在知識庫中對應的規範摘要（未來由後端 RAG 提供） */
export const KB_SNIPPETS: Record<Domain, string> = {
  FE: 'Coding Standards §2：React 18 + TypeScript strict，樣式使用 Tailwind；共用元件放在 /web/src/components，狀態管理用 Zustand。',
  BE: 'API 規格 v2：所有端點需 JWT（Bearer）；錯誤格式 {code, message}；資料存取使用 SQLModel，資料表變更以 Alembic 遷移。',
  AI: 'PRD §4：AI 輸出需為結構化 JSON（Epic → Story → Sub-task）；向量庫為 pgvector，模型與檢索參數設定見 /ai/config.py。',
  QA: 'README §CI：GitHub Actions 於 PR 觸發 lint + unit + e2e；E2E 使用 Playwright，測試資料以 /scripts/seed.py 建立。',
  DS: 'Figma UI Kit v2：卡片圓角 16/24px、主色 #111827；狀態色 orange / sky / violet；元件需提供 hover、focus、disabled 狀態。',
};

export const REFERENCE_PATHS: Record<Domain, string[]> = {
  FE: ['/web/src/pages/', '/web/src/components/'],
  BE: ['/api/app/routers/', '/api/app/models/'],
  AI: ['/ai/pipelines/', '/ai/config.py'],
  QA: ['/e2e/', '/.github/workflows/ci.yml'],
  DS: ['Figma › Taskline UI Kit v2'],
};

export const TECH_LIMITS: Record<Domain, string> = {
  FE: '遵循本專案 React + TypeScript + Tailwind 架構，不新增 UI 套件',
  BE: '遵循本專案 FastAPI 與 SQLModel 架構，資料表變更需附 Alembic migration',
  AI: '使用既有 LangChain pipeline 與 pgvector，不直接呼叫未封裝的模型 API',
  QA: '測試需能在 CI 無頭模式執行，不依賴外部服務',
  DS: '沿用 UI Kit v2 tokens，不新增未定義的色彩',
};

export const GENERIC_AC: Record<Domain, [string, string]> = {
  FE: ['畫面與 Figma 一致，375px 手機寬度正常', '具備載入、錯誤與空狀態'],
  BE: ['API 有文件（輸入／輸出／錯誤碼）', '關鍵路徑有單元測試且通過'],
  AI: ['有固定測試集與評估指標', '結果可重現（記錄參數與版本）'],
  QA: ['涵蓋主要流程與至少一個例外流程', '在 CI 上全數通過'],
  DS: ['提供 Figma 元件並標註互動狀態', '經一位前端成員確認可實作'],
};

export const DOMAIN_TAGS: Record<Domain, string[]> = {
  FE: ['React', 'TypeScript'],
  BE: ['FastAPI', 'PostgreSQL'],
  AI: ['LLM', 'RAG'],
  QA: ['Playwright'],
  DS: ['Figma', 'Design System'],
};

export interface SubTaskTemplate {
  title: string;
  domain: Domain;
  tags: string[];
  storyPoints: number;
  reason: string;
  slug: string;
  ac: string[];
}

export interface DecomposeTemplate {
  pattern: RegExp;
  epic: string;
  story: string;
  subs: SubTaskTemplate[];
}

/** AI 拆解模板：會議紀錄條目命中 pattern 時展開為 Sub-task */
export const DECOMPOSE_TEMPLATES: DecomposeTemplate[] = [
  {
    pattern: /左右分割|問專案|對話/,
    epic: '對話式 Prompt Studio',
    story: '成員能在任務內與 AI 釐清規格',
    subs: [
      { title: '任務詳情 Split View 介面（規格／對話）', domain: 'FE', tags: ['React', 'TypeScript', 'Tailwind'], storyPoints: 3, reason: '新版面＋對話元件，需處理串流訊息與 RWD', slug: 'split-view', ac: ['左側為任務規格與 Prompt 畫布，右側為對話區', '對話訊息支援串流顯示與 Markdown', '手機寬度改為上下排列'] },
      { title: '專案脈絡對話 API（掛載知識庫 RAG）', domain: 'AI', tags: ['LLM', 'RAG', 'Python'], storyPoints: 5, reason: '需整合向量檢索與任務／Sprint 脈絡組裝，屬新服務', slug: 'context-chat', ac: ['每次對話自動帶入任務規格、Sprint Goal 與相關文件片段', '回覆附上引用來源文件', '單次回應延遲 p90 < 3 秒'] },
    ],
  },
  {
    pattern: /Prompt.*(更新|版本|還原)|版本/,
    epic: '對話式 Prompt Studio',
    story: 'Prompt 會隨對話演進並可回溯',
    subs: [
      { title: 'Prompt 版本紀錄與還原 API', domain: 'BE', tags: ['FastAPI', 'PostgreSQL'], storyPoints: 3, reason: '涉及新資料表 prompt_versions 與遷移', slug: 'prompt-versions', ac: ['每次對話更新產生新版本並記錄差異', '可還原至任一歷史版本', 'API 有文件與單元測試'] },
      { title: 'Living Prompt 畫布（差異高亮、一鍵複製）', domain: 'FE', tags: ['React', 'TypeScript'], storyPoints: 2, reason: '延伸既有元件，主要為差異顯示', slug: 'living-prompt', ac: ['新增內容以高亮標示', '一鍵複製到剪貼簿', '顯示目前版本號並可切換'] },
    ],
  },
  {
    pattern: /三種模式|搶單|指定成員|Review.*模式/,
    epic: 'Review 策略路由',
    story: 'Leader 能依任務關鍵程度設定審核策略',
    subs: [
      { title: 'Review Policy 設定元件（三種模式）', domain: 'FE', tags: ['React', 'Tailwind'], storyPoints: 2, reason: '表單元件＋條件欄位，無新 API', slug: 'review-policy-ui', ac: ['支援 Leader 專審／團隊搶單／指定成員', '指定成員可設定需 1 人或全員同意', '任務層級設定可覆蓋專案預設'] },
      { title: 'Review 路由與通知服務', domain: 'BE', tags: ['FastAPI', 'PostgreSQL'], storyPoints: 5, reason: '需設計審核狀態機與通知派發，涉及資料表更動', slug: 'review-routing', ac: ['依策略發送個人通知或推送公共池', 'Claim 具併發保護，同時只有一人認領成功', '全員同意模式需全部核准才轉 Done'] },
    ],
  },
  {
    pattern: /In Review|誰在審|多久/,
    epic: 'Review 策略路由',
    story: '看板能清楚呈現審核進度',
    subs: [
      { title: 'In Review 卡片狀態視覺（專審／認領／計時）', domain: 'FE', tags: ['React', 'Tailwind'], storyPoints: 2, reason: '純前端呈現，依既有設計規範', slug: 'review-card', ac: ['專審卡片顯示等待中標記', '開放認領卡片顯示 Claim Review 按鈕', '已認領顯示審查人與經過時間'] },
      { title: 'Review 狀態視覺規範', domain: 'DS', tags: ['Figma', 'Design System'], storyPoints: 1, reason: '延伸既有元件庫', slug: 'review-visual', ac: ['定義三種審核狀態的色彩與標記', '提供 Figma 元件與標註'] },
    ],
  },
  {
    pattern: /webhook|PR 開啟|GitHub PR/i,
    epic: 'Review 策略路由',
    story: 'PR 開啟時任務自動進入審核',
    subs: [
      { title: 'GitHub PR Webhook 接收與簽章驗證', domain: 'BE', tags: ['FastAPI', 'Docker'], storyPoints: 3, reason: '外部事件需驗證 HMAC 簽章並處理重送', slug: 'pr-webhook', ac: ['驗證 X-Hub-Signature-256，失敗回傳 401', 'PR opened 時任務轉為 In Review 並套用審核策略', '重複事件具冪等性'] },
    ],
  },
  {
    pattern: /通知|接受|協商/,
    epic: '認領與通知',
    story: '成員能確認或協商被指派的任務',
    subs: [
      { title: 'Action Required Inbox（接受／協商）', domain: 'FE', tags: ['React', 'TypeScript'], storyPoints: 3, reason: '新頁面＋對話框，含狀態回饋', slug: 'inbox', ac: ['顯示指派人、點數與任務摘要', '接受後狀態改為 Assigned', '協商需填原因並可建議人選，退回 Leader'] },
    ],
  },
  {
    pattern: /E2E|測試/,
    epic: '品質保證',
    story: '關鍵流程具備自動化測試',
    subs: [
      { title: 'E2E 測試：認領與 Review 流程', domain: 'QA', tags: ['Playwright', 'GitHub Actions'], storyPoints: 3, reason: '需建立多角色測試資料', slug: 'e2e-review', ac: ['涵蓋接受、協商退回與三種 Review 模式', '在 CI 自動執行並全數通過'] },
    ],
  },
];

export const SAMPLE_MINUTES = `# Sprint 3 規劃會議（11/09）
Sprint Goal：讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制

## 討論重點
- 任務詳情要改成左右分割，右邊是可以問專案問題的 AI 對話
- Prompt 要能隨對話更新，保留版本可以還原
- Review 要支援三種模式：Leader 專審、團隊搶單、指定成員
- 看板 In Review 卡片要顯示誰在審、審了多久
- 需要 GitHub PR webhook，PR 開啟時自動進 In Review
- 通知中心：成員可以接受或協商轉移
- E2E 測試涵蓋認領與 Review 流程`;
