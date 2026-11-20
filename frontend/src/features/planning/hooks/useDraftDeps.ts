import { useMemo } from 'react';
import { useMembers, useSprintContext } from '@/hooks/queries';
import { capOf, carrySP, dependencyPlan, type DepPlan } from '@/lib/planning';
import type { DraftDependency } from '@/types';
import { usePlanningStore } from '../store';

export interface DepInfo {
  id: string;
  code: string;
  title: string;
  kind: 'story' | 'task' | 'carry';
  /** 本輪延後，或上輪任務已決定延後 */
  deferred: boolean;
  /** Task 所屬 Story（Story 本身為 null） */
  storyId: string | null;
  assigned: boolean;
}

const EMPTY: DepPlan = { order: 1, chainSp: 0, chain: [], waitFor: [], unlocks: [], advice: null };

/**
 * 規劃草稿的相依查詢：id → 編號與狀態、誰依賴它，以及完成順序與建議（本輪完成、延至下輪、等待哪些項目）。
 * Task 的前置鏈上限用單人本輪 Capacity 的最大值，Story 用全隊 Capacity。
 */
export function useDraftDeps() {
  const draft = usePlanningStore((s) => s.draft);
  const { planning, carryTasks } = useSprintContext();
  const { data: members = [] } = useMembers();

  return useMemo(() => {
    const info = new Map<string, DepInfo>();
    draft?.stories.forEach((s) =>
      info.set(s.id, { id: s.id, code: s.code, title: s.title, kind: 'story', deferred: !!s.deferred, storyId: null, assigned: true }),
    );
    draft?.tasks.forEach((t) =>
      info.set(t.id, { id: t.id, code: t.code, title: t.title, kind: 'task', deferred: !!t.deferred, storyId: t.storyId, assigned: !!t.assigneeId }),
    );
    carryTasks.forEach((t) =>
      info.set(t.id, { id: t.id, code: t.id, title: t.title, kind: 'carry', deferred: t.carry === false, storyId: null, assigned: true }),
    );

    const caps = members.map((m) => capOf(planning, m));
    const taskLimit = Math.max(1, ...caps);
    const storyLimit = Math.max(1, caps.reduce((a, b) => a + b, 0));
    const external = new Map(carryTasks.map((t) => [t.id, { code: t.id, title: t.title, points: carrySP(t), deferred: t.carry === false }]));
    const taskPlans = dependencyPlan(
      (draft?.tasks ?? []).map((t) => ({ ...t, points: t.storyPoints, assigned: !!t.assigneeId })),
      external,
      taskLimit,
    );
    const storyPlans = dependencyPlan(
      (draft?.stories ?? []).map((s) => ({ ...s, points: s.storyPoints, assigned: true })),
      new Map(),
      storyLimit,
    );

    const resolve = (id: string) => info.get(id);
    /** 依賴 id、且本輪要處理的項目 */
    const dependents = (id: string): DepInfo[] =>
      draft
        ? [...draft.stories, ...draft.tasks].filter((x) => !x.deferred && x.dependsOn.some((d) => d.id === id)).map((x) => info.get(x.id)!)
        : [];
    /** 只保留找得到的相依（例如 AI 建議的對象沒有被拆出來時忽略） */
    const known = (deps: DraftDependency[]) => deps.filter((d) => info.has(d.id));
    const planOf = (id: string) => taskPlans.get(id) ?? storyPlans.get(id) ?? EMPTY;
    return { draft, resolve, dependents, known, carryTasks, planOf, taskLimit, storyLimit };
  }, [draft, carryTasks, members, planning]);
}
