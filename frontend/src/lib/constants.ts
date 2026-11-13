import type { Domain, ReviewMode, TaskState } from '@/types';

export type Tone = 'neutral' | 'orange' | 'sky' | 'violet' | 'red' | 'dark';

export const DOMAINS: Record<Domain, { label: string }> = {
  FE: { label: '前端' },
  BE: { label: '後端' },
  AI: { label: 'AI' },
  QA: { label: 'QA' },
  DS: { label: '設計' },
};

export const DOMAIN_KEYS = Object.keys(DOMAINS) as Domain[];

export const TASK_STATES: Record<TaskState, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  AI_DRAFT: { label: 'AI Suggestion', tone: 'violet' },
  PENDING_MEMBER: { label: 'Leader Approved', tone: 'orange' },
  RETURNED: { label: 'Returned', tone: 'red' },
  ASSIGNED: { label: 'Member Accepted', tone: 'sky' },
  TODO: { label: 'To Do', tone: 'neutral' },
  IN_PROGRESS: { label: 'In Progress', tone: 'orange' },
  IN_REVIEW: { label: 'In Review', tone: 'violet' },
  DONE: { label: 'Done', tone: 'sky' },
};

export const REVIEW_POLICIES: Record<ReviewMode, { label: string; en: string; usage: string }> = {
  leader: {
    label: 'Leader 專審',
    en: 'PO / Leader Only',
    usage: '商業邏輯重大變更、資料庫遷移、架構核心調整',
  },
  pool: {
    label: '團隊搶單認領',
    en: 'First-available / Peer Pool',
    usage: '一般 CRUD、前端元件修飾、小型 Bug 修復',
  },
  target: {
    label: '指定成員 / 領域',
    en: 'Targeted Specialist',
    usage: '跨職能審核：請設計師看畫面、請維運審查部署',
  },
};

export const REVIEW_MODES = Object.keys(REVIEW_POLICIES) as ReviewMode[];

export const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8] as const;

/** 圖表與狀態用色，僅用於資料呈現 */
export const CHART_COLORS = {
  orange: '#F97316',
  sky: '#0EA5E9',
  violet: '#8B5CF6',
  track: '#E5E7EB',
  reference: '#9CA3AF',
  grid: '#F3F4F6',
  axis: '#6B7280',
} as const;
