export type ReviewMode = 'leader' | 'pool' | 'target';
export type ReviewRule = 'any' | 'all';

export interface ReviewPolicy {
  mode: ReviewMode;
  /** mode = target 時的指定審查者 */
  targets: string[];
  /** mode = target 時需 1 人或全員同意 */
  rule: ReviewRule;
}
