import type { KnowledgeDoc, Organization, Project, Sprint } from '@/types';

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
  prefix: 'TL',
  provider: 'GitHub',
  repo: 'github.com/atlab/taskline',
  branchPattern: 'feature/{prefix}-{id}-{slug}',
  sprintLength: '2 週',
  defaultPolicy: { mode: 'pool', targets: [], rule: 'any' },
  activeSprintId: 2,
  planningSprintId: 3,
});

export const seedSprints = (): Sprint[] => [
  { id: 2, name: 'Sprint 2', start: '10/27', end: '11/09', goal: '完成會議紀錄匯入、AI 拆解與指派推薦的第一版', status: 'active' },
  { id: 3, name: 'Sprint 3', start: '11/10', end: '11/23', goal: '', status: 'planning' },
];

export const seedDocs = (): KnowledgeDoc[] => [
  { id: 'd1', name: 'PRD_v2.md', kind: 'PRD', size: '38 KB', progress: 100, chunks: 42, isLink: false },
  { id: 'd2', name: '系統架構圖.png', kind: '架構圖', size: '1.2 MB', progress: 100, chunks: 6, isLink: false },
  { id: 'd3', name: 'openapi.yaml', kind: 'API 規格', size: '64 KB', progress: 100, chunks: 58, isLink: false },
  { id: 'd4', name: 'CODING_STANDARDS.md', kind: 'Coding Standards', size: '12 KB', progress: 100, chunks: 15, isLink: false },
  { id: 'd5', name: 'README.md', kind: 'README', size: '8 KB', progress: 100, chunks: 9, isLink: false },
  { id: 'd6', name: 'Figma · Taskline UI Kit v2', kind: 'Figma', size: '連結', progress: 100, chunks: 24, isLink: true },
];
