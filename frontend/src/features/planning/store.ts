import { create } from 'zustand';
import type { PlanningChatMessage, PlanningDraft, PlanningStage, StoryDraft, TaskDraft } from '@/types';

const STAGE_ORDER: PlanningStage[] = ['setup', 'stories', 'tasks', 'review'];
export const stageIndex = (s: PlanningStage) => STAGE_ORDER.indexOf(s);

/** 同一 Story 中、排在 currentId 之後的下一張未指派 Task（循環搜尋，不含自己） */
export function nextUnassignedId(tasks: TaskDraft[], storyId: string, currentId: string | null): string | null {
  const list = tasks.filter((t) => t.storyId === storyId);
  const start = list.findIndex((t) => t.id === currentId);
  for (let i = 1; i <= list.length; i++) {
    const t = list[(start + i + list.length) % list.length];
    if (t && !t.assigneeId && t.id !== currentId) return t.id;
  }
  return null;
}

const firstUnassignedOrFirst = (tasks: TaskDraft[] | undefined, storyId: string | null) => {
  const list = tasks?.filter((t) => t.storyId === storyId) ?? [];
  return (list.find((t) => !t.assigneeId) ?? list[0])?.id ?? null;
};

interface PlanningState {
  stage: PlanningStage;
  /** 已到達的最後階段，步驟條只允許切換到已到達的階段 */
  reached: PlanningStage;
  draft: PlanningDraft | null;
  selectedStoryId: string | null;
  activeStoryId: string | null;
  selectedTaskId: string | null;
  storyChat: PlanningChatMessage[];
  /** Team Capacity 是否展開各成員的任務直欄 */
  capacityExpanded: boolean;
  /** 階段 B 中收合的 Task 卡片 */
  collapsedTaskIds: string[];
  /** 程式跳轉時要捲動到的 Task（使用者點擊選取不捲動） */
  scrollTarget: string | null;
  /** 「開啟 Sprint 與設定」有未儲存的修改 */
  setupDirty: boolean;
  /** 設定有未儲存修改時，使用者想切換到的階段（等待確認） */
  pendingStage: PlanningStage | null;

  toggleCapacity: () => void;
  toggleTaskCollapsed: (id: string) => void;
  /**
   * 指派或取消指派（memberId = null）。
   * 由未指派變為已指派時自動收合該卡片，並聚焦展開同一 Story 的下一張未指派 Task。
   */
  assignTask: (taskId: string, memberId: string | null) => void;
  /** 聚焦到目前 Story 的下一張未指派 Task */
  jumpToNextUnassigned: () => void;
  clearScrollTarget: () => void;
  setStage: (stage: PlanningStage) => void;
  /** 使用者從步驟條切換階段：設定有未儲存修改時先記為 pendingStage，由設定頁詢問 */
  requestStage: (stage: PlanningStage) => void;
  clearPendingStage: () => void;
  setSetupDirty: (dirty: boolean) => void;
  loadDraft: (draft: PlanningDraft) => void;
  updateStory: (id: string, patch: Partial<StoryDraft>) => void;
  addStory: () => string;
  /** 加入新拆解出的 Task（進入階段 B 時） */
  appendTasks: (tasks: TaskDraft[]) => void;
  updateTask: (id: string, patch: Partial<TaskDraft>) => void;
  addTask: (storyId: string) => void;
  removeTask: (id: string) => void;
  selectStory: (id: string) => void;
  setActiveStory: (id: string) => void;
  selectTask: (id: string) => void;
  pushChat: (msg: Omit<PlanningChatMessage, 'id'>) => void;
  reset: () => void;
}

const initial = {
  stage: 'setup' as PlanningStage,
  reached: 'setup' as PlanningStage,
  draft: null,
  selectedStoryId: null,
  activeStoryId: null,
  selectedTaskId: null,
  storyChat: [],
  capacityExpanded: true,
  collapsedTaskIds: [] as string[],
  scrollTarget: null as string | null,
  setupDirty: false,
  pendingStage: null as PlanningStage | null,
};

let seq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

/** Sprint 規劃流程狀態機（純前端草稿，核准後才送到後端） */
export const usePlanningStore = create<PlanningState>()((set, get) => ({
  ...initial,

  setStage: (stage) =>
    set((s) => {
      const firstStory = s.draft?.stories[0]?.id ?? null;
      const activeStoryId = s.activeStoryId ?? firstStory;
      return {
        stage,
        reached: stageIndex(stage) > stageIndex(s.reached) ? stage : s.reached,
        activeStoryId,
        selectedTaskId: s.selectedTaskId ?? firstUnassignedOrFirst(s.draft?.tasks, activeStoryId),
      };
    }),

  requestStage: (stage) => {
    const s = get();
    if (s.stage === 'setup' && stage !== 'setup' && s.setupDirty) set({ pendingStage: stage });
    else s.setStage(stage);
  },

  clearPendingStage: () => set({ pendingStage: null }),

  setSetupDirty: (setupDirty) => set({ setupDirty }),

  loadDraft: (draft) =>
    set({
      draft,
      stage: 'stories',
      reached: 'stories',
      selectedStoryId: draft.stories[0]?.id ?? null,
      activeStoryId: draft.stories[0]?.id ?? null,
      selectedTaskId: draft.tasks[0]?.id ?? null,
      storyChat: [
        {
          id: nextId('msg'),
          role: 'assistant',
          text: `我依據會議紀錄切分出 ${draft.stories.length} 個 Story。點選左側 Story 可以查看切分依據與原文溯源；如果想調整範疇或點數，直接在下方告訴我。確認後再逐一拆解成 Task。`,
        },
      ],
    }),

  updateStory: (id, patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, stories: s.draft.stories.map((st) => (st.id === id ? { ...st, ...patch } : st)) } } : {})),

  addStory: () => {
    const { draft } = get();
    if (!draft) return '';
    const id = nextId('st');
    const story: StoryDraft = {
      id,
      code: `S${draft.sprintId}-${draft.stories.length + 1}`,
      title: '新的 Story',
      userStory: '身為…，我想要…，以便…',
      storyPoints: 3,
      scope: [],
      rationale: '由 Leader 手動新增，沒有對應的 AI 拆解依據。',
      sources: [],
    };
    set({ draft: { ...draft, stories: [...draft.stories, story] }, selectedStoryId: id });
    return id;
  },

  appendTasks: (tasks) => set((s) => (s.draft ? { draft: { ...s.draft, tasks: [...s.draft.tasks, ...tasks] } } : {})),

  updateTask: (id, patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, tasks: s.draft.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) } } : {})),

  addTask: (storyId) => {
    const { draft } = get();
    if (!draft) return;
    const nums = draft.tasks.map((t) => Number(t.code.split('-')[1]) || 0);
    const prefix = draft.tasks[0]?.code.split('-')[0] ?? 'TL';
    const task: TaskDraft = {
      id: nextId('tk'),
      storyId,
      code: `${prefix}-${Math.max(300, ...nums) + 1}`,
      title: '新的 Task',
      domain: 'FE',
      branchPrefix: 'feat',
      branchSlug: 'new-task',
      storyPoints: 2,
      acceptanceCriteria: ['成果與會議決議一致'],
      assigneeId: null,
      suggestedAssigneeId: null,
      reviewer: { mode: 'pool', memberId: null },
      analysis: '由 Leader 手動新增，尚無 AI 技術分析。',
      assignReason: '手動新增的 Task 沒有 AI 指派建議，請依成員負載自行指派。',
    };
    set({ draft: { ...draft, tasks: [...draft.tasks, task] }, selectedTaskId: task.id });
  },

  removeTask: (id) =>
    set((s) => (s.draft ? { draft: { ...s.draft, tasks: s.draft.tasks.filter((t) => t.id !== id) } } : {})),

  selectStory: (selectedStoryId) => set({ selectedStoryId }),
  setActiveStory: (activeStoryId) =>
    set((s) => ({ activeStoryId, selectedTaskId: firstUnassignedOrFirst(s.draft?.tasks, activeStoryId) })),
  selectTask: (selectedTaskId) => set({ selectedTaskId }),
  toggleCapacity: () => set((s) => ({ capacityExpanded: !s.capacityExpanded })),

  toggleTaskCollapsed: (id) =>
    set((s) => ({
      collapsedTaskIds: s.collapsedTaskIds.includes(id) ? s.collapsedTaskIds.filter((x) => x !== id) : [...s.collapsedTaskIds, id],
    })),

  assignTask: (taskId, memberId) =>
    set((s) => {
      const task = s.draft?.tasks.find((t) => t.id === taskId);
      if (!s.draft || !task || task.assigneeId === memberId) return {};
      const tasks = s.draft.tasks.map((t) => (t.id === taskId ? { ...t, assigneeId: memberId } : t));
      const next: Partial<PlanningState> = { draft: { ...s.draft, tasks } };

      if (!memberId) {
        // 退回未指派：展開以便重新處理
        next.collapsedTaskIds = s.collapsedTaskIds.filter((x) => x !== taskId);
      } else if (!task.assigneeId) {
        // 首次指派：收合此卡；若屬於目前 Story，聚焦並展開下一張未指派
        let collapsed = [...new Set([...s.collapsedTaskIds, taskId])];
        if (task.storyId === s.activeStoryId) {
          const target = nextUnassignedId(tasks, task.storyId, taskId);
          if (target) {
            next.selectedTaskId = target;
            next.scrollTarget = target;
            collapsed = collapsed.filter((x) => x !== target);
          }
        }
        next.collapsedTaskIds = collapsed;
      }
      return next;
    }),

  jumpToNextUnassigned: () =>
    set((s) => {
      if (!s.draft || !s.activeStoryId) return {};
      const target = nextUnassignedId(s.draft.tasks, s.activeStoryId, s.selectedTaskId);
      return target
        ? { selectedTaskId: target, scrollTarget: target, collapsedTaskIds: s.collapsedTaskIds.filter((x) => x !== target) }
        : {};
    }),

  clearScrollTarget: () => set({ scrollTarget: null }),
  pushChat: (msg) => set((s) => ({ storyChat: [...s.storyChat, { ...msg, id: nextId('msg') }] })),
  reset: () => set(initial),
}));
