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

export const SAMPLE_MINUTES = `# Sprint 3 規劃會議（11/09）：對話式 Prompt Studio 與 PR Review 機制
Sprint Goal：讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制

## 討論重點
- 任務詳情要改成左右分割，右邊是可以問專案問題的 AI 對話
- Prompt 要能隨對話更新，保留版本可以還原
- Review 要支援三種模式：Leader 專審、團隊搶單、指定成員
- 看板 In Review 卡片要顯示誰在審、審了多久
- 需要 GitHub PR webhook，PR 開啟時自動進 In Review
- 通知中心：成員可以接受或協商轉移
- E2E 測試涵蓋認領與 Review 流程`;
