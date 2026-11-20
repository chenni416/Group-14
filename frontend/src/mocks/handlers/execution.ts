import { demoToday, spreadDates } from '@/lib/execution';
import type { ExecutionPlan, KnowledgeDoc, Sprint, Task } from '@/types';

/** 規則式模擬 AI：依已確認的任務規格、依賴與專案文件產生執行計畫建議（純函式） */
export function buildPlan(task: Task, sprint: Sprint, ctx: { taskMap: Map<string, Task>; docs: KnowledgeDoc[] }): ExecutionPlan {
  const today = demoToday(sprint);
  const texts = [
    { text: '閱讀任務規格與驗收條件', acIndex: null as number | null },
    { text: `建立 branch：${task.branch}`, acIndex: null },
    ...task.acceptanceCriteria.map((ac, i) => ({ text: `完成：${ac}`, acIndex: i as number | null })),
    { text: '補上測試或驗證紀錄', acIndex: null },
    { text: '自我檢查並發布 PR', acIndex: null },
  ];
  const dates = spreadDates(today < sprint.endDate ? today : sprint.endDate, sprint.endDate, texts.length);
  const n = texts.length;

  const docNames = ctx.docs.filter((d) => /PRD|openapi|CODING/i.test(d.name)).slice(0, 3);
  // 前置任務來自規劃時確認的相依，原因一併帶入依賴檢查
  const deps = task.dependsOn
    .map((d) => ({ dep: ctx.taskMap.get(d.id), reason: d.reason }))
    .filter((x): x is { dep: Task; reason: string } => !!x.dep)
    .map(({ dep, reason }) => ({
      id: `dc-${dep.id}`,
      text: `${dep.id} ${dep.title} 已完成`,
      met: dep.state === 'DONE',
      source: reason ? `前置任務 · ${reason}` : `任務 ${dep.id}`,
    }));
  const docChecks = docNames.map((d) => ({ id: `dc-${d.id}`, text: `已閱讀 ${d.name}`, met: false, source: '知識庫' }));
  const depChecks = [...deps, ...docChecks];
  if (!depChecks.length) depChecks.push({ id: 'dc-env', text: '開發環境可正常執行', met: false, source: '手動' });

  return {
    taskId: task.id,
    checklist: texts.map((t, i) => ({ id: `ck-${i + 1}`, text: t.text, done: false, acIndex: t.acIndex, dueAt: dates[i] ?? null })),
    checkpoints: [
      { id: 'cp-1', title: '規格與環境就緒', dueAt: dates[1] ?? sprint.endDate, reachedAt: null },
      { id: 'cp-2', title: '核心功能完成', dueAt: dates[Math.floor(n * 0.65)] ?? sprint.endDate, reachedAt: null },
      { id: 'cp-3', title: '準備送審', dueAt: dates[n - 1] ?? sprint.endDate, reachedAt: null },
    ],
    depChecks,
    origin: 'ai',
    edited: false,
    confirmedAt: null,
  };
}
