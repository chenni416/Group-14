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
  | 'DONE';

export const BOARD_STATES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const satisfies readonly TaskState[];
export type BoardState = (typeof BOARD_STATES)[number];

export const DRAFT_STATES: readonly TaskState[] = ['AI_DRAFT', 'DRAFT'];

export interface PullRequest {
  number: number;
  status: 'open' | 'merged';
}

export interface Negotiation {
  byId: string;
  reason: string;
  suggestId: string | null;
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
