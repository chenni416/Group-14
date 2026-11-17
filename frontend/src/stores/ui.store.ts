import { create } from 'zustand';
import type { ReviewItemsInput } from '@/services';

export type BoardFilter = 'all' | 'mine' | 'review' | 'blocked';
export type InboxFilter = 'all' | 'invite' | 'review' | 'returned' | 'collab';
/** 看板右側欄 */
export type CollabPanel = 'issues' | 'proposals' | null;
export type MyTasksTab = 'doing' | 'todo';

interface UiState {
  boardFilter: BoardFilter;
  inboxFilter: InboxFilter;
  myTasksTab: MyTasksTab;
  onboardingStep: number;
  collabPanel: CollabPanel;
  setCollabPanel: (v: CollabPanel) => void;
  /** Reviewer 在驗收表調整的判斷，按核准或要求修改時一併送出 */
  reviewDrafts: Record<string, ReviewItemsInput>;
  setReviewDraft: (taskId: string, items: ReviewItemsInput) => void;
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
  collabPanel: null,
  setCollabPanel: (collabPanel) => set({ collabPanel }),
  reviewDrafts: {},
  setReviewDraft: (taskId, items) => set((s) => ({ reviewDrafts: { ...s.reviewDrafts, [taskId]: items } })),
  setBoardFilter: (boardFilter) => set({ boardFilter }),
  setInboxFilter: (inboxFilter) => set({ inboxFilter }),
  setMyTasksTab: (myTasksTab) => set({ myTasksTab }),
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
}));
