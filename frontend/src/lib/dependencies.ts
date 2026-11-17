import type { Dependency, Task } from '@/types';

/**
 * G2：依相依性分析把本次任務分成「可平行」「需等待」「建議延後」（純函式）。
 * - 建議延後：依賴的前置任務已延後（高風險），不能如期開始
 * - 需等待：前置任務仍在進行或帶入中，要排在後面或等前置任務完成
 * - 可平行：沒有相依，或前置任務已完成，可以同時開始；點數大的排前面，優先安排
 */
export interface GroupedTask {
  task: Task;
  deps: Dependency[];
}

export interface TaskGroups {
  parallel: GroupedTask[];
  waiting: GroupedTask[];
  deferSuggest: GroupedTask[];
}

export function groupTasks(tasks: Task[], dependencies: Dependency[]): TaskGroups {
  const out: TaskGroups = { parallel: [], waiting: [], deferSuggest: [] };
  tasks.forEach((task) => {
    const deps = dependencies.filter((d) => d.taskId === task.id);
    const item = { task, deps };
    if (deps.some((d) => d.risk === 'high')) out.deferSuggest.push(item);
    else if (deps.some((d) => d.risk === 'mid')) out.waiting.push(item);
    else out.parallel.push(item);
  });
  out.parallel.sort((a, b) => b.task.storyPoints - a.task.storyPoints);
  return out;
}

/** 依賴圖的每個節點所在的欄：沒有前置任務的在第 0 欄，其餘為前置任務的最深欄 + 1 */
export function dependencyLevels(edges: Array<Pick<Dependency, 'taskId' | 'dependsOnId'>>): Map<string, number> {
  const parents = new Map<string, string[]>();
  edges.forEach((e) => parents.set(e.taskId, [...(parents.get(e.taskId) ?? []), e.dependsOnId]));
  const level = new Map<string, number>();
  const visit = (id: string, stack: Set<string>): number => {
    const known = level.get(id);
    if (known != null) return known;
    if (stack.has(id)) return 0;
    stack.add(id);
    const ps = parents.get(id) ?? [];
    const v = ps.length ? Math.max(...ps.map((p) => visit(p, stack))) + 1 : 0;
    stack.delete(id);
    level.set(id, v);
    return v;
  };
  edges.forEach((e) => {
    visit(e.taskId, new Set());
    visit(e.dependsOnId, new Set());
  });
  return level;
}
