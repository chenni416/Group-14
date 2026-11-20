/** G4：問題回報與提案 */
export type IssueType = 'tech' | 'dependency' | 'schedule' | 'other';

/** Report → Assign Owner → Respond → Resolve / Replan */
export type IssueStatus = 'reported' | 'assigned' | 'responded' | 'resolved' | 'replan';

export interface IssueResponse {
  id: string;
  byId: string;
  text: string;
  at: string;
}

export interface Issue {
  id: string;
  taskId: string;
  type: IssueType;
  description: string;
  reporterId: string;
  /** 目前處理人；null 表示還沒指派 */
  ownerId: string | null;
  /** 系統推薦的處理人與理由 */
  suggestedOwnerId: string | null;
  ownerReason: string;
  status: IssueStatus;
  responses: IssueResponse[];
  createdAt: string;
  /** 狀態最後變更時間，用來計算等待多久 */
  updatedAt: string;
  /** 被納入的 Sprint；null 表示尚未納入 */
  sprintId: number;
}

export interface ReportIssueInput {
  taskId: string;
  type: IssueType;
  description: string;
  /** 回報者想請的人（可空） */
  preferOwnerId: string | null;
}

export type ProposalKind = 'idea' | 'improve' | 'change';
export type ProposalStatus = 'open' | 'adopted' | 'rejected' | 'nextSprint';

export interface ProposalComment {
  id: string;
  byId: string;
  text: string;
  at: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  kind: ProposalKind;
  authorId: string;
  taskId: string | null;
  status: ProposalStatus;
  /** 決策理由；未決策時為空 */
  decision: string;
  decidedById: string | null;
  comments: ProposalComment[];
  createdAt: string;
  sprintId: number;
}

export interface CreateProposalInput {
  title: string;
  description: string;
  kind: ProposalKind;
  taskId: string | null;
}

export interface DecideProposalInput {
  decision: Exclude<ProposalStatus, 'open'>;
  reason: string;
}
