/** G5：交付與驗收 */
export type AcVerdict = 'met' | 'unclear' | 'mismatch';

/** 成員送審時提交的交付內容（PR 資料為 mock，不串 GitHub） */
export interface Delivery {
  prUrl: string;
  /** 逐項對應 Deliverables */
  deliverables: { text: string; provided: boolean }[];
  testNote: string;
  unfinished: string;
  questions: string;
  submittedAt: string;
}

export interface SubmitDeliveryInput {
  prUrl: string;
  deliverables: { text: string; provided: boolean }[];
  testNote: string;
  unfinished: string;
  questions: string;
}

export interface AcceptanceItem {
  ac: string;
  /** AI 判斷 */
  ai: AcVerdict;
  /** 證據：PR 的檔案、變更摘要或測試結果（mock） */
  evidence: string;
  /** Reviewer 調整後的判斷；null 表示沿用 AI */
  reviewer: AcVerdict | null;
  note: string;
}

/** AI 驗收檢查的整體結果 */
export interface AcceptanceCheck {
  taskId: string;
  items: AcceptanceItem[];
  /** 交付物是否齊全 */
  deliverablesComplete: boolean;
  missingDeliverables: string[];
  /** PR 與 Task Goal、Scope 的符合度說明 */
  goalMatch: { label: string; verdict: AcVerdict; detail: string }[];
  tests: 'passed' | 'failed' | 'none';
  testSummary: string;
  unfinished: string[];
  questions: string[];
  changedFiles: string[];
  summary: string;
}

export type AcceptanceDecision = 'approved' | 'changes';

export interface AcceptanceRecord {
  id: string;
  taskId: string;
  items: AcceptanceItem[];
  decision: AcceptanceDecision;
  reason: string;
  reviewerId: string;
  at: string;
}

export interface SaveAcceptanceInput {
  items: Pick<AcceptanceItem, 'reviewer' | 'note'>[];
}
