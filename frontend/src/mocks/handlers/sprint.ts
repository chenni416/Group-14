import { TASK_STATES } from '@/lib/constants';
import { isUnfinished } from '@/lib/planning';
import type { ClarifyQuestion, Dependency } from '@/types';
import { CLARIFY_RULES, DEPENDENCY_RULES } from '../data/knowledge';
import { db, findSprint, planTasks, prevSprintId, sprintTasks } from '../db';

/** 建立新 Sprint 時自動帶入的「延續事項」：上個 Sprint 未完成、延後、跨 Sprint 的問題 */
export function carryOverText(prevId: number | null): { text: string; count: number } {
  const lines: string[] = [];
  if (prevId != null) {
    const prev = findSprint(prevId);
    sprintTasks(prevId)
      .filter(isUnfinished)
      .forEach((t) =>
        lines.push(`- [延續] ${t.id} ${t.title}（${prev.name} 未完成 · ${TASK_STATES[t.state].label} · ${t.storyPoints} SP）`),
      );
  }
  db.backlog
    .filter((b) => b.usedInSprintId == null)
    .forEach((b) =>
      lines.push(
        b.kind === 'multi'
          ? `- [跨 Sprint] ${b.text}（自 ${b.fromSprint} 延續）`
          : `- [延後] ${b.text}（${b.fromSprint} 延後）`,
      ),
    );
  return { text: lines.length ? ['## 延續事項（系統自動帶入）', ...lines].join('\n') : '', count: lines.length };
}

/** AI 找出會議紀錄沒講清楚的地方；保留先前已回答的內容 */
export function findQuestions(minutes: string, previous: ClarifyQuestion[] | null): ClarifyQuestion[] {
  const body = minutes
    .split('\n')
    .filter((l) => !/\[延續\]/.test(l))
    .join('\n');
  return CLARIFY_RULES.filter((r) => r.trigger.test(body)).map((r) => ({
    id: r.id,
    question: r.question,
    options: r.options,
    answer: previous?.find((q) => q.id === r.id)?.answer ?? '',
  }));
}

/** AI 相依性分析：本次任務是否依賴上一個 Sprint 的任務 */
export function analyzeDependencies(sprintId: number): Dependency[] {
  const prev = prevSprintId(sprintId);
  if (prev == null) return [];
  const prevTasks = sprintTasks(prev);
  const out: Dependency[] = [];
  planTasks(sprintId).forEach((t) =>
    DEPENDENCY_RULES.forEach((rule) => {
      if (!rule.task.test(t.title)) return;
      prevTasks
        .filter((x) => rule.dependsOn.test(x.title))
        .forEach((x) =>
          out.push({
            taskId: t.id,
            dependsOnId: x.id,
            reason: rule.reason,
            risk: x.state === 'DONE' ? 'ok' : x.carry ? 'mid' : 'high',
          }),
        );
    }),
  );
  const order = { high: 0, mid: 1, ok: 2 };
  return out.sort((a, b) => order[a.risk] - order[b.risk]);
}
