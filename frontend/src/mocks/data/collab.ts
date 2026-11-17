import type { Issue, Proposal, Retro } from '@/types';

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const seedIssues = (): Issue[] => [
  {
    id: 'IS-1',
    taskId: 'TL-204',
    type: 'dependency',
    description: '指派推薦需要成員負載資料，但知識庫索引的欄位格式還沒確定。',
    reporterId: 'm2',
    ownerId: 'm3',
    suggestedOwnerId: 'm3',
    ownerReason: '被依賴的 TL-207 由 王思妤 負責',
    status: 'assigned',
    responses: [],
    createdAt: ago(30),
    updatedAt: ago(30),
    sprintId: 2,
  },
  {
    id: 'IS-2',
    taskId: 'TL-203',
    type: 'tech',
    description: '雙欄版面在手機寬度會跑版。',
    reporterId: 'm1',
    ownerId: 'm5',
    suggestedOwnerId: 'm5',
    ownerReason: '李雅婷 與此任務同領域，剩餘容量最多（4 SP）',
    status: 'resolved',
    responses: [{ id: 'r1', byId: 'm5', text: '已提供手機版設計稿，改為上下排列。', at: ago(20) }],
    createdAt: ago(48),
    updatedAt: ago(20),
    sprintId: 2,
  },
  {
    id: 'IS-3',
    taskId: 'TL-207',
    type: 'schedule',
    description: '索引大型文件耗時過長，可能趕不上「核心功能完成」的 Checkpoint。',
    reporterId: 'm3',
    ownerId: null,
    suggestedOwnerId: 'm1',
    ownerReason: '同領域沒有可協助的成員，指給 Leader 判斷',
    status: 'reported',
    responses: [],
    createdAt: ago(5),
    updatedAt: ago(5),
    sprintId: 2,
  },
];

export const seedProposals = (): Proposal[] => [
  {
    id: 'PP-1',
    title: 'Review 通知同步寄送 Email',
    description: '目前只有站內通知，成員不一定會即時看到審查邀請。',
    kind: 'change',
    authorId: 'm4',
    taskId: null,
    status: 'open',
    decision: '',
    decidedById: null,
    comments: [{ id: 'c1', byId: 'm2', text: '後端可以沿用現有通知服務擴充，約 3 SP。', at: ago(10) }],
    createdAt: ago(26),
    sprintId: 2,
  },
  {
    id: 'PP-2',
    title: '看板卡片顯示審查等待時間',
    description: '讓審查者一眼看出哪些 PR 已經等很久。',
    kind: 'improve',
    authorId: 'm5',
    taskId: 'TL-210',
    status: 'nextSprint',
    decision: 'Sprint 2 時程已滿，排入下一個 Sprint。',
    decidedById: 'm1',
    comments: [],
    createdAt: ago(60),
    sprintId: 2,
  },
];

export const seedRetros = (): Retro[] => [
  {
    sprintId: 1,
    status: 'closed',
    entries: [
      { id: 'e1', byId: 'm1', well: '知識庫與團隊設定在第一週就完成。', hard: '需求在會議後才補充，估點不準。', improve: '會議前先整理好待釐清問題。' },
      { id: 'e2', byId: 'm2', well: '後端 API 規格先對齊，整合很順利。', hard: '前後端欄位命名不一致。', improve: '共用型別或契約先定案。' },
    ],
    actions: [
      { id: 'a1', text: '每次規劃會議前先整理待釐清問題', ownerId: 'm1', done: true, fromSprintId: 1, usedInSprintId: 2 },
      { id: 'a2', text: '前後端欄位命名在開工前對齊並記錄', ownerId: 'm2', done: false, fromSprintId: 1, usedInSprintId: null },
    ],
  },
];
