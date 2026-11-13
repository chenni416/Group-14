export type SprintStatus = 'planning' | 'active' | 'closed';

export interface Sprint {
  id: number;
  name: string;
  start: string;
  end: string;
  goal: string;
  status: SprintStatus;
}

export interface BurndownPoint {
  label: string;
  ideal: number;
  actual: number | null;
}
