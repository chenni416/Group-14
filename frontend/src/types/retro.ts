/** G7：Sprint 結束與 Retrospective */
export interface RetroEntry {
  id: string;
  byId: string;
  well: string;
  hard: string;
  improve: string;
}

export interface RetroAction {
  id: string;
  text: string;
  ownerId: string;
  done: boolean;
  /** 來自哪個 Sprint 的回顧 */
  fromSprintId: number;
  /** 已帶入哪個 Sprint 的規劃；null 表示尚未帶入 */
  usedInSprintId: number | null;
}

export type RetroStatus = 'open' | 'closed';

export interface Retro {
  sprintId: number;
  status: RetroStatus;
  entries: RetroEntry[];
  actions: RetroAction[];
}

export interface SubmitRetroEntryInput {
  well: string;
  hard: string;
  improve: string;
}

export interface AddRetroActionInput {
  text: string;
  ownerId: string;
}
