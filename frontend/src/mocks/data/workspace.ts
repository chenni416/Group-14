import type { BacklogItem, KnowledgeDoc, Organization, Project, Sprint } from '@/types';

export const seedOrg = (): Organization => ({
  name: 'NYCU ATLAB',
  slug: 'atlab',
  plan: 'Team',
  teams: [
    { name: '第 3 組 · Taskline', memberCount: 5, current: true },
    { name: '第 1 組 · 校園二手平台', memberCount: 4, current: false },
    { name: '第 5 組 · 課程評價爬蟲', memberCount: 4, current: false },
  ],
});

export const seedProject = (): Project => ({
  name: 'Taskline — 會議到交付平台',
  goal: '讓團隊在每次 Sprint Planning 後，都清楚誰負責什麼、做到哪裡，並能根據實際成果持續調整計畫。',
  prefix: 'TL',
  provider: 'GitHub',
  repo: 'atlab/taskline',
  branchPattern: 'feature/{prefix}-{id}-{slug}',
  sprintLength: '2 週',
  defaultPolicy: { mode: 'pool', targets: [], rule: 'any' },
  gitIntegration: true,
  activeSprintId: 2,
  // 尚未建立 Sprint 3：從「Sprint 列表 → 建立 Sprint」開始規劃
  planningSprintId: null,
});

const sprintBase = { minutes: '', docs: [], questions: null, step: 5 as const };

export const seedSprints = (): Sprint[] => [
  {
    ...sprintBase,
    id: 1,
    name: 'Sprint 1',
    start: '10/13',
    end: '10/26',
    startDate: '2026-10-13',
    endDate: '2026-10-26',
    goal: '完成專案初始化、知識庫上傳與團隊設定',
    status: 'closed',
    capacity: { m1: 8, m2: 10, m3: 8, m4: 8, m5: 6 },
    summary: { total: 20, done: 18, tasks: 7 },
  },
  {
    ...sprintBase,
    id: 2,
    name: 'Sprint 2',
    start: '10/27',
    end: '11/09',
    startDate: '2026-10-27',
    endDate: '2026-11-09',
    goal: '完成會議紀錄匯入、AI 拆解與指派推薦的第一版',
    status: 'active',
    capacity: { m1: 8, m2: 10, m3: 8, m4: 8, m5: 6 },
    summary: null,
  },
];

/** 延續事項：延後或需要跨多個 Sprint 的問題 */
export const seedBacklog = (): BacklogItem[] => [
  { id: 'b1', text: 'Email 推播提醒：指派與審查事件寄信通知', fromSprint: 'Sprint 2', kind: 'deferred', taskId: null, usedInSprintId: null, decision: null },
  { id: 'b2', text: 'AI 拆解準確率評估：建立標註資料集並每個 Sprint 追蹤', fromSprint: 'Sprint 1', kind: 'multi', taskId: null, usedInSprintId: null, decision: null },
];

export const seedDocs = (): KnowledgeDoc[] => [
  { id: 'd1', name: 'PRD_v2.md', kind: 'PRD', size: '38 KB', progress: 100, chunks: 42, isLink: false },
  { id: 'd2', name: '系統架構圖.png', kind: '架構圖', size: '1.2 MB', progress: 100, chunks: 6, isLink: false },
  { id: 'd3', name: 'openapi.yaml', kind: 'API 規格', size: '64 KB', progress: 100, chunks: 58, isLink: false },
  { id: 'd4', name: 'CODING_STANDARDS.md', kind: 'Coding Standards', size: '12 KB', progress: 100, chunks: 15, isLink: false },
  { id: 'd5', name: 'README.md', kind: 'README', size: '8 KB', progress: 100, chunks: 9, isLink: false },
  { id: 'd6', name: 'Figma · Taskline UI Kit v2', kind: 'Figma', size: '連結', progress: 100, chunks: 24, isLink: true },
];
