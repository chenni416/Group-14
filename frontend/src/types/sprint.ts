export type SprintStatus = 'planning' | 'active' | 'closed';

/** Planning Studio 四步驟：① 輸入 → ② AI 拆解 → ③ 審核調整 → ④ 核准發送 */
export type PlanningStep = 1 | 2 | 3 | 4;

export interface SprintDoc {
  name: string;
  size: string;
}

/** AI 從會議紀錄找出沒講清楚的地方；全部回答後才能拆解與分配任務 */
export interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
}

export interface SprintSummary {
  total: number;
  done: number;
  tasks: number;
}

export interface Sprint {
  id: number;
  name: string;
  /** 顯示用 MM/DD */
  start: string;
  end: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  goal: string;
  status: SprintStatus;
  /** 本次 Capacity：建立 Sprint 時直接預估每位成員的點數（不匯入課表或行事曆） */
  capacity: Record<string, number>;
  /** 本次會議紀錄 */
  minutes: string;
  /** 本次文件資料 */
  docs: SprintDoc[];
  /** null 表示尚未分析會議紀錄 */
  questions: ClarifyQuestion[] | null;
  step: PlanningStep;
  /** 結束時的完成統計 */
  summary: SprintSummary | null;
}

/** 延續事項：延後或跨 Sprint 的問題，建立下一個 Sprint 時自動帶入會議紀錄 */
export interface BacklogItem {
  id: string;
  text: string;
  fromSprint: string;
  kind: 'deferred' | 'multi';
  taskId: string | null;
  /** 已寫入哪個 Sprint 的會議紀錄；null 表示尚未帶入 */
  usedInSprintId: number | null;
}

export interface NewSprintDefaults {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  capacity: Record<string, number>;
  /** 已預先帶入「延續事項」的會議紀錄 */
  minutes: string;
  carryCount: number;
}

export interface CreateSprintInput {
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  capacity: Record<string, number>;
  minutes: string;
  docs: SprintDoc[];
}

export interface UpdateSprintInput {
  goal?: string;
  minutes?: string;
}

export type DependencyRisk = 'high' | 'mid' | 'ok';

/** AI 相依性分析：本次任務依賴上一個 Sprint（prev）或本 Sprint（same）的哪個任務 */
export interface Dependency {
  scope: 'prev' | 'same';
  taskId: string;
  dependsOnId: string;
  reason: string;
  risk: DependencyRisk;
}

export interface BurndownPoint {
  label: string;
  ideal: number;
  actual: number | null;
}
