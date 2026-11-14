import type { Task } from '@/types';

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
