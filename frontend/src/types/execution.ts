/** G3：成員接受任務後的執行計畫 */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  /** 對應第幾條驗收條件（0 起算）；null 表示不對應 */
  acIndex: number | null;
  /** YYYY-MM-DD */
  dueAt: string | null;
}

export interface Checkpoint {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  dueAt: string;
  reachedAt: string | null;
}

/** 執行所需的前置條件與資訊 */
export interface DepCheck {
  id: string;
  text: string;
  met: boolean;
  /** 來源：依賴任務、知識庫文件或手動 */
  source: string;
}

export interface ExecutionPlan {
  taskId: string;
  checklist: ChecklistItem[];
  checkpoints: Checkpoint[];
  depChecks: DepCheck[];
  /** AI 建議 / 成員自己建立 */
  origin: 'ai' | 'human';
  /** 成員是否調整過 AI 建議 */
  edited: boolean;
  /** null 表示尚未確認 */
  confirmedAt: string | null;
}

export type SaveExecutionPlanInput = Pick<ExecutionPlan, 'checklist' | 'checkpoints' | 'depChecks'>;
