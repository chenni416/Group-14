import { create } from 'zustand';

export type BoardFilter = 'all' | 'mine' | 'review';
export type InboxFilter = 'all' | 'invite' | 'review' | 'returned';
export type MyTasksTab = 'doing' | 'todo';

interface UiState {
  boardFilter: BoardFilter;
  inboxFilter: InboxFilter;
  myTasksTab: MyTasksTab;
  onboardingStep: number;
  setBoardFilter: (v: BoardFilter) => void;
  setInboxFilter: (v: InboxFilter) => void;
  setMyTasksTab: (v: MyTasksTab) => void;
  setOnboardingStep: (v: number) => void;
}

/** 純 UI 狀態（篩選、分頁）；伺服器資料一律交給 TanStack Query */
export const useUiStore = create<UiState>()((set) => ({
  boardFilter: 'all',
  inboxFilter: 'all',
  myTasksTab: 'doing',
  onboardingStep: 0,
  setBoardFilter: (boardFilter) => set({ boardFilter }),
  setInboxFilter: (inboxFilter) => set({ inboxFilter }),
  setMyTasksTab: (myTasksTab) => set({ myTasksTab }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
}));
