import type { Member, Task } from '@/types';

/** 各成員在規劃中 Sprint 已被分配的 Story Points */
export function plannedLoad(members: Member[], tasks: Task[]): Record<string, number> {
  const load: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  tasks.forEach((t) => {
    load[t.assigneeId] = (load[t.assigneeId] ?? 0) + t.storyPoints;
  });
  return load;
}

/** 依 Epic → Story 分組 */
export function groupByEpic(tasks: Task[]) {
  const epics = new Map<string, Map<string, Task[]>>();
  tasks.forEach((t) => {
    const epic = t.epic || '手動任務';
    const story = t.story || '—';
    if (!epics.has(epic)) epics.set(epic, new Map());
    const stories = epics.get(epic)!;
    stories.set(story, [...(stories.get(story) ?? []), t]);
  });
  return epics;
}
