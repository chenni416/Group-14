import type { Domain } from './member';
import type { ReviewPolicy } from './review-policy';

export type TaskState =
  | 'DRAFT'
  | 'AI_DRAFT'
  | 'PENDING_MEMBER'
  | 'RETURNED'
  | 'ASSIGNED'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  /** 延後到下個 Sprint */
  | 'DEFERRED';

export const BOARD_STATES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const satisfies readonly TaskState[];
export type BoardState = (typeof BOARD_STATES)[number];

export const DRAFT_STATES: readonly TaskState[] = ['AI_DRAFT', 'DRAFT'];

/** Leader 可在 Planning Studio 修改的狀態（草稿與協商退回） */
export const EDITABLE_PLAN_STATES: readonly TaskState[] = ['AI_DRAFT', 'DRAFT', 'RETURNED'];

export interface PullRequest {
  number: number;
  status: 'open' | 'merged';
}

export interface Negotiation {
  byId: string;
  reason: string;
  suggestId: string | null;
}

/** 協商退回當下的內容，用來列出 Leader 修改了哪些地方 */
export interface ReturnSnapshot {
  title: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  storyPointsReason: string;
  assigneeId: string;
  policy: ReviewPolicy;
}

export interface Task {
  id: string;
  sprintId: number;
  title: string;
  description: string;
  domain: Domain;
  tags: string[];
  storyPoints: number;
  storyPointsReason: string;
  acceptanceCriteria: string[];
  epic: string;
  story: string;
  origin: 'ai' | 'human';
  /** Leader 是否調整過 AI 建議 */
  edited: boolean;
  state: TaskState;
  assigneeId: string;
  suggestedAssigneeId: string | null;
  suggestReason: string;
  policy: ReviewPolicy;
  policyReason: string;
  reviewerId: string | null;
  approvals: string[];
  claimedAt: string | null;
  reviewStartedAt: string | null;
  pr: PullRequest | null;
  branch: string;
  negotiation: Negotiation | null;
  /** 來源句：任務來自會議紀錄的哪一句 */
  source: string;
  /** 由延續事項帶入（延後 / 跨 Sprint） */
  carryTag: 'deferred' | 'multi' | null;
  /** 需要延續一個 Sprint 以上 */
  multiSprint: boolean;
  /** 驗收條件已套用待釐清問題的回答 */
  clarified: boolean;
  /** 未完成時是否帶入下一個 Sprint（false = 延後） */
  carry: boolean;
  returnSnapshot: ReturnSnapshot | null;
  /** 延後前的狀態，用來恢復 */
  prevState: TaskState | null;
}

export interface UpdateTaskInput {
  title?: string;
  storyPoints?: number;
  storyPointsReason?: string;
  /** 空字串表示未指派 */
  assigneeId?: string;
  acceptanceCriteria?: string[];
  policy?: ReviewPolicy;
  multiSprint?: boolean;
}

export interface CreateTaskInput {
  title: string;
  domain: Domain;
  storyPoints: number;
  storyPointsReason: string;
  /** 空字串表示未指派，核准前檢查會擋下 */
  assigneeId: string;
  acceptanceCriteria: string[];
  policy: ReviewPolicy;
  source: string;
}

export interface NegotiateInput {
  reason: string;
  suggestId: string | null;
}

/** 協商退回後，Leader 編輯並重新派工 */
export interface ReviseTaskInput {
  title: string;
  storyPoints: number;
  acceptanceCriteria: string[];
  assigneeId: string;
  policy: ReviewPolicy;
}
