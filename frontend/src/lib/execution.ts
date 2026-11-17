import type { Checkpoint, ChecklistItem, ExecutionPlan, Sprint, Task } from '@/types';

/**
 * 執行計畫的共用規則（純函式）。
 * Mock 資料的 Sprint 日期早已過期，為了展示「落後」判斷，今天若不在 Sprint 期間內就以期間的 60% 處代替。
 */
const DAY = 86_400_000;
const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const toDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function demoToday(sprint: Pick<Sprint, 'startDate' | 'endDate'> | undefined, now = Date.now()): string {
  if (!sprint) return toDate(now);
  const start = toTime(sprint.startDate);
  const end = toTime(sprint.endDate);
  if (now >= start && now <= end + DAY) return toDate(now);
  return toDate(start + Math.round(((end - start) / DAY) * 0.6) * DAY);
}

/** 在 start～end 之間平均分配 n 個日期（含終點） */
export function spreadDates(start: string, end: string, n: number): string[] {
  const s = toTime(start);
  const e = toTime(end);
  if (n <= 1) return [end];
  return Array.from({ length: n }, (_, i) => toDate(s + Math.round(((e - s) * (i + 1)) / n / DAY) * DAY));
}

export const formatDay = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function checklistProgress(plan: Pick<ExecutionPlan, 'checklist'> | undefined) {
  const total = plan?.checklist.length ?? 0;
  const done = plan?.checklist.filter((c) => c.done).length ?? 0;
  return { done, total };
}

/** 下一個要做的 Checklist 項目（依預計日期，沒有日期的排最後） */
export function nextChecklistItem(plan: Pick<ExecutionPlan, 'checklist'> | undefined): ChecklistItem | undefined {
  return plan?.checklist.filter((c) => !c.done).sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))[0];
}

export function nextCheckpoint(plan: Pick<ExecutionPlan, 'checkpoints'> | undefined): Checkpoint | undefined {
  return plan?.checkpoints.filter((c) => !c.reachedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
}

/** 進度落後：有 Checkpoint 已過期但尚未達成，或預計日期已過的 Checklist 項目還沒做完 */
export function isBehind(plan: ExecutionPlan | undefined, today: string): boolean {
  if (!plan?.confirmedAt) return false;
  const lateCheckpoint = plan.checkpoints.some((c) => !c.reachedAt && c.dueAt < today);
  const lateItem = plan.checklist.some((c) => !c.done && c.dueAt != null && c.dueAt < today);
  return lateCheckpoint || lateItem;
}

/** 計畫是否超出 Sprint 結束日 */
export const planOverrun = (plan: Pick<ExecutionPlan, 'checklist' | 'checkpoints'>, endDate: string) =>
  [...plan.checklist.map((c) => c.dueAt), ...plan.checkpoints.map((c) => c.dueAt)].some((d) => d != null && d > endDate);

/** 前置任務尚未完成 */
export const blockedBy = (task: Task, taskMap: Map<string, Task>): Task[] =>
  task.dependsOn.map((id) => taskMap.get(id)).filter((t): t is Task => !!t && t.state !== 'DONE');
