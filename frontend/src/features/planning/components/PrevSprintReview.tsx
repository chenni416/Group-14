import { Check, Sparkles } from 'lucide-react';
import { Avatar, Badge, ProgressBar, SegmentedControl } from '@/components/ui';
import { TASK_STATES, type Tone } from '@/lib/constants';
import { sum } from '@/lib/format';
import { carrySP } from '@/lib/planning';
import type { Dependency, DependencyRisk, Member, Sprint, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

const RISK: Record<DependencyRisk, { label: string; tone: Tone; hint: string }> = {
  high: { label: '高風險：前置任務已延後', tone: 'red', hint: '，建議一併延後或把前置任務改為帶入' },
  mid: { label: '注意：前置任務仍在進行', tone: 'orange', hint: '，建議排在 Sprint 後半或先完成前置任務' },
  ok: { label: '已滿足', tone: 'sky', hint: '' },
};

interface Props {
  previous: Sprint;
  previousTasks: Task[];
  carryTasks: Task[];
  dependencies: Dependency[];
  hasPlanTasks: boolean;
  memberMap: Map<string, Member>;
  taskMap: Map<string, Task>;
  isLead: boolean;
}

/** 第二次 Sprint 起：上一個 Sprint 的完成內容與進度，並由 AI 分析相依性 */
export function PrevSprintReview({ previous, previousTasks, carryTasks, dependencies, hasPlanTasks, memberMap, taskMap, isLead }: Props) {
  const { setCarry } = usePlanningMutations();
  const done = previousTasks.filter((t) => t.state === 'DONE');
  const stats =
    previous.status === 'closed' && previous.summary
      ? previous.summary
      : { total: sum(previousTasks.map((t) => t.storyPoints)), done: sum(done.map((t) => t.storyPoints)), tasks: previousTasks.length };
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section className="mb-6 rounded-3xl border border-gray-100 p-4" aria-label="上一個 Sprint 回顧">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">上一個 Sprint 回顧 · {previous.name}</h3>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{pct}%</span> 完成 · {stats.done}/{stats.total} SP
        </span>
      </div>
      <ProgressBar value={stats.done} max={stats.total} tone="sky" size="sm" label={`${previous.name} 完成度`} className="mb-4" />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-gray-500">已完成（{done.length}）</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {done.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5">
                <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" strokeWidth={2.4} />
                <span className="font-mono text-xs text-gray-500">{t.id}</span>
                <span className="truncate">{t.title}</span>
              </li>
            ))}
            {!done.length && <li className="py-1.5 text-xs text-gray-400">—</li>}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs text-gray-500">未完成（{carryTasks.length}）· 選擇帶入本 Sprint 或延後</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {carryTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 py-1.5">
                <Avatar member={memberMap.get(t.assigneeId)} size="xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-mono text-xs text-gray-500">{t.id}</span> {t.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {TASK_STATES[t.state].label} · 剩約 {carrySP(t)} SP
                  </div>
                </div>
                <SegmentedControl<'carry' | 'defer'>
                  size="sm"
                  aria-label={`${t.id} 帶入或延後`}
                  value={t.carry ? 'carry' : 'defer'}
                  onChange={(v) => setCarry.mutate({ id: t.id, carry: v === 'carry' })}
                  options={[
                    { value: 'carry', label: '帶入', disabled: !isLead },
                    { value: 'defer', label: '延後', disabled: !isLead },
                  ]}
                  className="shrink-0 flex-nowrap gap-1"
                />
              </li>
            ))}
            {!carryTasks.length && <li className="py-1.5 text-xs text-gray-400">全部完成</li>}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3 text-sm">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          AI 相依性分析
        </div>
        {!hasPlanTasks ? (
          <p className="text-gray-600">拆解完成後，會分析本次任務與上一個 Sprint 的相依性。</p>
        ) : !dependencies.length ? (
          <p className="text-gray-600">未發現與上一個 Sprint 的相依性。</p>
        ) : (
          <ul className="divide-y divide-violet-100">
            {dependencies.map((d) => {
              const t = taskMap.get(d.taskId);
              const x = taskMap.get(d.dependsOnId);
              const r = RISK[d.risk];
              return (
                <li key={`${d.taskId}-${d.dependsOnId}`} className="flex flex-wrap items-start gap-2 py-2">
                  <Badge tone={r.tone} dot>
                    {r.label}
                  </Badge>
                  <div className="min-w-0 flex-1 text-gray-700">
                    <span className="font-medium">{d.taskId}</span> {t?.title} 依賴 <span className="font-medium">{d.dependsOnId}</span> {x?.title}
                    {x && `（${TASK_STATES[x.state].label}）`}
                    <div className="text-xs text-gray-500">
                      {d.reason}
                      {r.hint}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
