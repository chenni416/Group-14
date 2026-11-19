export type NotificationType =
  | 'invite'
  | 'review'
  | 'pool'
  | 'returned'
  | 'info'
  /** G4：問題待處理或已回應 */
  | 'issue'
  /** G4：新提案，通知 Leader 決策 */
  | 'proposal'
  /** G2：Leader 延後或調整，請成員同意或提出異議 */
  | 'plan'
  /** 任務留言中被 @ 標注 */
  | 'mention';

export interface Notification {
  id: string;
  toId: string;
  fromId: string;
  type: NotificationType;
  /** 提案可以沒有關聯任務，此時為空字串 */
  taskId: string;
  /** 問題或提案的編號 */
  refId?: string;
  text: string;
  createdAt: string;
  status: 'pending' | 'done';
}
