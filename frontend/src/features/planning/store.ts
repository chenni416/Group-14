import { create } from 'zustand';
import { dependentClosure, normalizeDraft, storyCode, taskCode } from '@/lib/planning';
import { toast } from '@/stores/toast.store';
import type { DraftDependency, PlanningChatMessage, PlanningDraft, PlanningStage, StoryDraft, TaskDraft } from '@/types';

const STAGE_ORDER: PlanningStage[] = ['carry', 'setup', 'stories', 'tasks', 'review'];
export const stageIndex = (s: PlanningStage) => STAGE_ORDER.indexOf(s);

/** 同一 Story 中、排在 currentId 之後的下一張未指派 Task（循環搜尋，不含自己） */
export function nextUnassignedId(tasks: TaskDraft[], storyId: string, currentId: string | null): string | null {
  const list = tasks.filter((t) => t.storyId === storyId && !t.deferred);
  const start = list.findIndex((t) => t.id === currentId);
  for (let i = 1; i <= list.length; i++) {
    const t = list[(start + i + list.length) % list.length];
    if (t && !t.assigneeId && t.id !== currentId) return t.id;
  }
  return null;
}

/** 依 Story 與 Task 序號排序 */
const sortTasks = (list: TaskDraft[], stories: StoryDraft[]) => {
  const order = new Map(stories.map((s) => [s.id, s.no]));
  return [...list].sort((a, b) => (order.get(a.storyId) ?? 0) - (order.get(b.storyId) ?? 0) || a.no - b.no);
};
const dropDeps = <T extends { dependsOn: DraftDependency[] }>(list: T[], ids: Set<string>) =>
  list.map((x) => (x.dependsOn.some((d) => ids.has(d.id)) ? { ...x, dependsOn: x.dependsOn.filter((d) => !ids.has(d.id)) } : x));

export type DepKind = 'story' | 'task';

/** 延後時受影響（直接或間接依賴它）的本輪項目，等待 Leader 選擇處理方式 */
export interface DeferRequest {
  kind: DepKind;
  id: string;
  code: string;
  /** 要延後的項目本身與它底下的 Task id（移除相依時用） */
  targetIds: string[];
  affectedStories: string[];
  affectedTasks: string[];
}

/** 取消延後時仍在延後中的前置項目（直接或間接需先完成），等待 Leader 選擇處理方式 */
export interface RestoreRequest {
  kind: DepKind;
  id: string;
  code: string;
  /** 要取消延後的項目本身與它底下的 Task id（移除相依時用） */
  targetIds: string[];
  prereqStories: string[];
  prereqTasks: string[];
}

/** 從 startIds 沿著 dependsOn 往前找，收集仍在延後中的前置項目（遇到本輪項目即停止） */
function deferredPrereqs<T extends { id: string; deferred?: boolean; dependsOn: DraftDependency[] }>(items: T[], startIds: string[]): T[] {
  const map = new Map(items.map((x) => [x.id, x]));
  const out = new Map<string, T>();
  const queue = [...startIds];
  while (queue.length) {
    const cur = map.get(queue.shift()!);
    cur?.dependsOn.forEach((d) => {
      const dep = map.get(d.id);
      if (!dep?.deferred || startIds.includes(dep.id) || out.has(dep.id)) return;
      out.set(dep.id, dep);
      queue.push(dep.id);
    });
  }
  return [...out.values()];
}

const firstUnassignedOrFirst = (tasks: TaskDraft[] | undefined, storyId: string | null) => {
  const list = tasks?.filter((t) => t.storyId === storyId && !t.deferred) ?? [];
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
  /** 延後（本輪不處理）：留在原位並標註；Story 連同底下所有 Task 一起延後 */
  deferItems: (ids: { stories?: string[]; tasks?: string[] }) => void;
  /** 取消延後：Story 連同底下的 Task；Task 所屬的 Story 也延後時一併取消 Story 的延後 */
  restoreStory: (id: string) => void;
  restoreTask: (id: string) => void;
  addDependency: (kind: DepKind, itemId: string, dep: DraftDependency) => void;
  removeDependency: (kind: DepKind, itemId: string, depId: string) => void;
  /** 移除所有指向 ids 的相依（延後時選「移除相依，只延後這項」） */
  dropDependenciesOn: (ids: string[]) => void;
  deferRequest: DeferRequest | null;
  /** 延後入口：沒有其他項目依賴時直接延後；有的話先記為 deferRequest，由對話框讓 Leader 選擇 */
  requestDefer: (kind: DepKind, id: string) => void;
  /** with：一起延後受影響的項目；drop：移除指向它的相依後只延後這項 */
  resolveDefer: (mode: 'with' | 'drop') => void;
  cancelDefer: () => void;
  restoreRequest: RestoreRequest | null;
  /** 取消延後入口：需先完成的項目都在本輪時直接取消；仍有延後的前置項目時先記為 restoreRequest，由對話框讓 Leader 選擇 */
  requestRestore: (kind: DepKind, id: string) => void;
  /** with：前置項目一起取消延後；drop：移除對延後前置項目的相依後只取消延後這項 */
  resolveRestore: (mode: 'with' | 'drop') => void;
  cancelRestore: () => void;
  selectStory: (id: string) => void;
  setActiveStory: (id: string) => void;
  selectTask: (id: string) => void;
  pushChat: (msg: Omit<PlanningChatMessage, 'id'>) => void;
  reset: () => void;
}

const initial = {
  stage: 'carry' as PlanningStage,
  reached: 'carry' as PlanningStage,
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
  deferRequest: null as DeferRequest | null,
  restoreRequest: null as RestoreRequest | null,
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

  loadDraft: (raw) => {
    const draft = normalizeDraft(raw);
    set({
      draft,
      stage: 'stories',
      reached: 'stories',
      selectedStoryId: draft.stories[0]?.id ?? null,
      activeStoryId: draft.stories[0]?.id ?? null,
      selectedTaskId: draft.tasks[0]?.id ?? null,
      storyChat: [],
    });
  },

  updateStory: (id, patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, stories: s.draft.stories.map((st) => (st.id === id ? { ...st, ...patch } : st)) } } : {})),

  addStory: () => {
    const { draft } = get();
    if (!draft) return '';
    const id = nextId('st');
    const no = Math.max(0, ...draft.stories.map((s) => s.no)) + 1;
    const story: StoryDraft = {
      id,
      no,
      code: storyCode(draft.sprintId, no),
      title: '新的 Story',
      userStory: '身為…，我想要…，以便…',
      storyPoints: 3,
      scope: [],
      rationale: '由 Leader 手動新增，沒有對應的 AI 拆解依據。',
      sources: [],
      dependsOn: [],
    };
    set({ draft: { ...draft, stories: [...draft.stories, story] }, selectedStoryId: id });
    return id;
  },

  appendTasks: (tasks) =>
    set((s) =>
      s.draft
        ? { draft: { ...s.draft, tasks: sortTasks([...s.draft.tasks, ...tasks.map((t) => ({ ...t, dependsOn: t.dependsOn ?? [] }))], s.draft.stories) } }
        : {},
    ),

  updateTask: (id, patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, tasks: s.draft.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) } } : {})),

  addTask: (storyId) => {
    const { draft } = get();
    if (!draft) return;
    const story = draft.stories.find((s) => s.id === storyId);
    if (!story) return;
    const no = Math.max(0, ...draft.tasks.filter((t) => t.storyId === storyId).map((t) => t.no)) + 1;
    const task: TaskDraft = {
      id: nextId('tk'),
      storyId,
      no,
      code: taskCode(draft.sprintId, story.no, no),
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
      dependsOn: [],
    };
    set({ draft: { ...draft, tasks: sortTasks([...draft.tasks, task], draft.stories) }, selectedTaskId: task.id });
  },

  removeTask: (id) =>
    set((s) =>
      s.draft ? { draft: { ...s.draft, tasks: dropDeps(s.draft.tasks.filter((t) => t.id !== id), new Set([id])) } } : {},
    ),

  deferItems: ({ stories = [], tasks = [] }) =>
    set((s) => {
      if (!s.draft) return {};
      const d = s.draft;
      const storyIds = new Set(stories);
      const taskIds = new Set(tasks);
      return {
        draft: {
          ...d,
          stories: d.stories.map((x) => (storyIds.has(x.id) ? { ...x, deferred: true } : x)),
          tasks: d.tasks.map((x) => (taskIds.has(x.id) || storyIds.has(x.storyId) ? { ...x, deferred: true } : x)),
        },
      };
    }),

  restoreStory: (id) =>
    set((s) =>
      s.draft
        ? {
            draft: {
              ...s.draft,
              stories: s.draft.stories.map((x) => (x.id === id ? { ...x, deferred: false } : x)),
              tasks: s.draft.tasks.map((x) => (x.storyId === id ? { ...x, deferred: false } : x)),
            },
          }
        : {},
    ),

  restoreTask: (id) =>
    set((s) => {
      if (!s.draft) return {};
      const task = s.draft.tasks.find((x) => x.id === id);
      if (!task) return {};
      return {
        draft: {
          ...s.draft,
          stories: s.draft.stories.map((x) => (x.id === task.storyId ? { ...x, deferred: false } : x)),
          tasks: s.draft.tasks.map((x) => (x.id === id ? { ...x, deferred: false } : x)),
        },
      };
    }),

  addDependency: (kind, itemId, dep) =>
    set((s) => {
      if (!s.draft) return {};
      const add = <T extends { id: string; dependsOn: DraftDependency[] }>(list: T[]) =>
        list.map((x) => (x.id === itemId && !x.dependsOn.some((d) => d.id === dep.id) ? { ...x, dependsOn: [...x.dependsOn, dep] } : x));
      return { draft: kind === 'story' ? { ...s.draft, stories: add(s.draft.stories) } : { ...s.draft, tasks: add(s.draft.tasks) } };
    }),

  removeDependency: (kind, itemId, depId) =>
    set((s) => {
      if (!s.draft) return {};
      const rm = <T extends { id: string; dependsOn: DraftDependency[] }>(list: T[]) =>
        list.map((x) => (x.id === itemId ? { ...x, dependsOn: x.dependsOn.filter((d) => d.id !== depId) } : x));
      return { draft: kind === 'story' ? { ...s.draft, stories: rm(s.draft.stories) } : { ...s.draft, tasks: rm(s.draft.tasks) } };
    }),

  requestDefer: (kind, id) => {
    const { draft } = get();
    if (!draft) return;
    const item = kind === 'story' ? draft.stories.find((x) => x.id === id) : draft.tasks.find((x) => x.id === id);
    if (!item) return;
    const stories = draft.stories.filter((x) => !x.deferred);
    const tasks = draft.tasks.filter((x) => !x.deferred);
    const ownTasks = kind === 'story' ? tasks.filter((t) => t.storyId === id).map((t) => t.id) : [];
    const affectedStories = kind === 'story' ? dependentClosure(stories, [id]).map((x) => x.id) : [];
    const skip = new Set(affectedStories);
    const affectedTasks = dependentClosure(tasks, kind === 'story' ? ownTasks : [id])
      .filter((t) => !ownTasks.includes(t.id) && !skip.has(t.storyId))
      .map((t) => t.id);
    if (!affectedStories.length && !affectedTasks.length) {
      get().deferItems(kind === 'story' ? { stories: [id] } : { tasks: [id] });
      toast(`${item.code} 已標註延後，本輪不處理；可隨時取消延後`);
      return;
    }
    set({ deferRequest: { kind, id, code: item.code, targetIds: [id, ...ownTasks], affectedStories, affectedTasks } });
  },

  resolveDefer: (mode) => {
    const req = get().deferRequest;
    if (!req) return;
    const self = req.kind === 'story' ? { stories: [req.id], tasks: [] as string[] } : { stories: [] as string[], tasks: [req.id] };
    if (mode === 'with') {
      get().deferItems({ stories: [...self.stories, ...req.affectedStories], tasks: [...self.tasks, ...req.affectedTasks] });
      toast(`已延後 ${req.code} 與 ${req.affectedStories.length + req.affectedTasks.length} 項後續項目，可隨時取消延後`);
    } else {
      get().dropDependenciesOn(req.targetIds);
      get().deferItems(self);
      toast(`${req.code} 已延後，後續項目改為不需等待它`);
    }
    set({ deferRequest: null });
  },

  cancelDefer: () => set({ deferRequest: null }),

  requestRestore: (kind, id) => {
    const { draft } = get();
    if (!draft) return;
    const item = kind === 'story' ? draft.stories.find((x) => x.id === id) : draft.tasks.find((x) => x.id === id);
    if (!item) return;
    const ownTasks = kind === 'story' ? draft.tasks.filter((t) => t.storyId === id).map((t) => t.id) : [];
    const prereqStories = kind === 'story' ? deferredPrereqs(draft.stories, [id]).map((x) => x.id) : [];
    const skipStories = new Set([id, ...prereqStories]);
    const prereqTasks = deferredPrereqs(draft.tasks, kind === 'story' ? ownTasks : [id])
      .filter((t) => !skipStories.has(t.storyId))
      .map((t) => t.id);
    const restore = () => (kind === 'story' ? get().restoreStory(id) : get().restoreTask(id));
    if (!prereqStories.length && !prereqTasks.length) {
      restore();
      toast(`${item.code} 已取消延後，回到本輪`);
      return;
    }
    set({ restoreRequest: { kind, id, code: item.code, targetIds: [id, ...ownTasks], prereqStories, prereqTasks } });
  },

  resolveRestore: (mode) => {
    const req = get().restoreRequest;
    if (!req) return;
    const st = get();
    if (mode === 'with') {
      req.prereqStories.forEach((x) => st.restoreStory(x));
      req.prereqTasks.forEach((x) => st.restoreTask(x));
      toast(`已取消延後 ${req.code} 與 ${req.prereqStories.length + req.prereqTasks.length} 項需先完成的項目`);
    } else {
      const targets = new Set(req.targetIds);
      const prereqs = new Set([...req.prereqStories, ...req.prereqTasks]);
      const drop = <T extends { id: string; dependsOn: DraftDependency[] }>(list: T[]) =>
        list.map((x) => (targets.has(x.id) ? { ...x, dependsOn: x.dependsOn.filter((d) => !prereqs.has(d.id)) } : x));
      set((s) => (s.draft ? { draft: { ...s.draft, stories: drop(s.draft.stories), tasks: drop(s.draft.tasks) } } : {}));
      toast(`${req.code} 已取消延後，並改為不需等待仍延後的項目`);
    }
    if (req.kind === 'story') get().restoreStory(req.id);
    else get().restoreTask(req.id);
    set({ restoreRequest: null });
  },

  cancelRestore: () => set({ restoreRequest: null }),

  dropDependenciesOn: (ids) =>
    set((s) => {
      if (!s.draft) return {};
      const set_ = new Set(ids);
      return { draft: { ...s.draft, stories: dropDeps(s.draft.stories, set_), tasks: dropDeps(s.draft.tasks, set_) } };
    }),

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
