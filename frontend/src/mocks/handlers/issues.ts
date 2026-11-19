import { capOf } from '@/lib/planning';
import type { IssueType, Member, Sprint, Task } from '@/types';

interface Ctx {
  tasks: Task[];
  members: Member[];
  sprint: Sprint | undefined;
  reporterId: string;
}

const LOAD_STATES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];

/**
 * 推薦問題處理人（純函式），共三條規則：
 * 1. 問題類型為「前置依賴」：推薦被依賴任務的負責人
 * 2. 否則推薦同領域、剩餘容量最多的成員（排除回報者）
 * 3. 都找不到時指給 Leader
 */
export function recommendOwner(input: { type: IssueType; taskId: string }, ctx: Ctx): { ownerId: string; reason: string } {
  const task = ctx.tasks.find((t) => t.id === input.taskId);
  const name = (id: string) => ctx.members.find((m) => m.id === id)?.name ?? '成員';

  if (task && input.type === 'dependency') {
    const dep = task.dependsOn
      .map((d) => ctx.tasks.find((t) => t.id === d.id))
      .find((t) => t && t.state !== 'DONE' && t.assigneeId !== ctx.reporterId);
    if (dep) return { ownerId: dep.assigneeId, reason: `被依賴的 ${dep.id} 由 ${name(dep.assigneeId)} 負責` };
  }

  if (task) {
    const load = (id: string) =>
      ctx.tasks
        .filter((t) => t.assigneeId === id && t.sprintId === task.sprintId && LOAD_STATES.includes(t.state))
        .reduce((a, t) => a + t.storyPoints, 0);
    const best = ctx.members
      .filter((m) => m.domain === task.domain && m.id !== ctx.reporterId)
      .map((m) => ({ m, remain: capOf(ctx.sprint, m) - load(m.id) }))
      .sort((a, b) => b.remain - a.remain)[0];
    if (best) return { ownerId: best.m.id, reason: `${best.m.name} 與此任務同領域，剩餘容量最多（${best.remain} SP）` };
  }

  const lead = ctx.members.find((m) => m.role === 'Leader' && m.id !== ctx.reporterId);
  return { ownerId: lead?.id ?? ctx.members[0]!.id, reason: '同領域沒有可協助的成員，指給 Leader 判斷' };
}
