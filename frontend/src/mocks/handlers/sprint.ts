import { carryBlock, replaceCarryBlock } from '@/lib/planning';
import type { ClarifyQuestion, Dependency } from '@/types';
import { CLARIFY_RULES, DEPENDENCY_RULES } from '../data/knowledge';
import { db, findSprint, planTasks, prevSprintId, sprintTasks } from '../db';

/**
 * 建立新 Sprint 時自動帶入會議紀錄的「延續事項」：只放在「上輪 Sprint 統整」選擇納入本輪、尚未寫進其他 Sprint 的項目。
 * 帶入的上輪未完成任務會以原任務移到新 Sprint，不寫進會議紀錄。
 */
export function carryOverText(sprintId: number | null = null): { text: string; count: number } {
  const items = db.backlog.filter((b) => b.decision === 'include' && (b.usedInSprintId == null || b.usedInSprintId === sprintId));
  return { text: carryBlock(items), count: items.length };
}

/** 規劃中 Sprint 的會議紀錄：依目前「納入本輪」的延續事項重寫延續區塊 */
export function syncCarryBlock(sprintId: number) {
  const sprint = findSprint(sprintId);
  sprint.minutes = replaceCarryBlock(sprint.minutes, carryOverText(sprintId).text);
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
            risk: x.state === 'DONE' ? 'ok' : x.carry === false ? 'high' : 'mid',
          }),
        );
    }),
  );
  const order = { high: 0, mid: 1, ok: 2 };
  return out.sort((a, b) => order[a.risk] - order[b.risk]);
}
