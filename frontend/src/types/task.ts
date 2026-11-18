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

/** 帶入／延後決定的成員確認：待確認、已接受、協商退回 */
export type CarryStatus = 'pending' | 'accepted' | 'returned';

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
  /** 上輪未完成任務的決定：true 帶入下一個 Sprint、false 延後、null 尚未決定 */
  carry: boolean | null;
  /** 帶入時改派的負責人（啟動 Sprint 時套用）；null 表示維持原負責人 */
  carryAssigneeId: string | null;
  /** Leader 重新評估的本輪完成剩餘工作所需點數；null 表示沿用原點數 */
  carryPoints: number | null;
  /** 送出派工後，成員對帶入／延後決定的確認狀態；null 表示尚未送出 */
  carryStatus: CarryStatus | null;
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

/** 上輪未完成任務：帶入或延後，帶入時可改派並重新評估點數（省略表示不變） */
export interface SetCarryInput {
  carry: boolean | null;
  assigneeId?: string | null;
  points?: number;
}
