import type { Domain, ReviewPolicy, TaskState } from '@/types';

export interface TaskSeed {
  id: string;
  title: string;
  domain: Domain;
  storyPoints: number;
  assigneeId: string;
  state: TaskState;
  policy: ReviewPolicy;
  slug: string;
  policyReason?: string;
  reviewerId?: string;
  approvals?: string[];
  /** 相對於現在的小時數 */
  claimedHoursAgo?: number;
  reviewHoursAgo?: number;
  pr?: { number: number; status: 'open' | 'merged' };
}

const pool: ReviewPolicy = { mode: 'pool', targets: [], rule: 'any' };
const leader: ReviewPolicy = { mode: 'leader', targets: [], rule: 'any' };

export const TASK_SEEDS: TaskSeed[] = [
  { id: 'TL-201', title: '會議紀錄上傳與格式正規化', domain: 'BE', storyPoints: 3, assigneeId: 'm2', state: 'DONE', policy: pool, slug: 'minutes-upload', reviewerId: 'm4', pr: { number: 28, status: 'merged' } },
  { id: 'TL-202', title: 'AI 任務拆解 Prompt 設計', domain: 'AI', storyPoints: 5, assigneeId: 'm3', state: 'IN_REVIEW', policy: leader, slug: 'decompose-prompt', reviewerId: 'm1', reviewHoursAgo: 3, pr: { number: 31, status: 'open' }, policyReason: '影響全系統拆解品質，建議 Leader 專審' },
  { id: 'TL-203', title: 'Sprint Planning 雙欄介面', domain: 'FE', storyPoints: 3, assigneeId: 'm1', state: 'IN_REVIEW', policy: pool, slug: 'planning-split', reviewerId: 'm4', claimedHoursAgo: 2, reviewHoursAgo: 5, pr: { number: 33, status: 'open' } },
  { id: 'TL-204', title: '指派推薦演算法服務', domain: 'BE', storyPoints: 5, assigneeId: 'm2', state: 'IN_PROGRESS', policy: leader, slug: 'assign-reco', policyReason: '涉及資料表更動，建議 Leader 專審' },
  { id: 'TL-205', title: '通知中心 UI 設計稿', domain: 'DS', storyPoints: 2, assigneeId: 'm5', state: 'IN_REVIEW', policy: pool, slug: 'inbox-design', reviewHoursAgo: 1, pr: { number: 34, status: 'open' } },
  { id: 'TL-206', title: 'CI 與 Playwright 測試環境', domain: 'QA', storyPoints: 2, assigneeId: 'm4', state: 'DONE', policy: pool, slug: 'ci-setup', reviewerId: 'm2', pr: { number: 27, status: 'merged' } },
  { id: 'TL-207', title: '知識庫文件索引 Pipeline', domain: 'AI', storyPoints: 3, assigneeId: 'm3', state: 'IN_PROGRESS', policy: { mode: 'target', targets: ['m2'], rule: 'any' }, slug: 'kb-index' },
  { id: 'TL-208', title: 'E2E：登入與專案建立流程', domain: 'QA', storyPoints: 2, assigneeId: 'm4', state: 'TODO', policy: pool, slug: 'e2e-login' },
  { id: 'TL-209', title: 'GitHub OAuth 登入', domain: 'BE', storyPoints: 2, assigneeId: 'm2', state: 'TODO', policy: leader, slug: 'oauth' },
  { id: 'TL-210', title: '看板卡片元件', domain: 'FE', storyPoints: 2, assigneeId: 'm1', state: 'IN_REVIEW', policy: { mode: 'target', targets: ['m5', 'm4'], rule: 'all' }, slug: 'kanban-card', approvals: ['m5'], reviewHoursAgo: 6, pr: { number: 32, status: 'open' }, policyReason: '跨職能：需設計師確認畫面、QA 確認互動' },
];

export interface NotificationSeed {
  toId: string;
  type: 'invite' | 'review' | 'pool' | 'returned' | 'info';
  taskId: string;
  fromId: string;
  hoursAgo: number;
  text: string;
  status?: 'pending' | 'done';
}

export const NOTIFICATION_SEEDS: NotificationSeed[] = [
  { toId: 'm1', type: 'review', taskId: 'TL-202', fromId: 'm3', hoursAgo: 3, text: '請你以 Leader 身分審查此任務的 PR #31' },
  ...['m1', 'm2', 'm3', 'm4'].map((toId) => ({ toId, type: 'pool' as const, taskId: 'TL-205', fromId: 'm5', hoursAgo: 1, text: 'PR #34 已開啟，任何有空的成員都可以領取審查' })),
  { toId: 'm4', type: 'review', taskId: 'TL-210', fromId: 'm1', hoursAgo: 6, text: '請你審查 PR #32（指定成員，需全員同意）' },
  { toId: 'm5', type: 'review', taskId: 'TL-210', fromId: 'm1', hoursAgo: 6, text: '請你審查 PR #32（指定成員，需全員同意）', status: 'done' },
  { toId: 'm4', type: 'info', taskId: 'TL-203', fromId: 'm1', hoursAgo: 2, text: '你已領取此任務的審查' },
];
