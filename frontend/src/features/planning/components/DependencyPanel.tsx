import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Avatar, Badge, Button, Callout, EmptyState } from '@/components/ui';
import { TASK_STATES, type Tone } from '@/lib/constants';
import { dependencyLevels, groupTasks, type GroupedTask } from '@/lib/dependencies';
import { mention } from '@/lib/format';
import { EDITABLE_PLAN_STATES, type Dependency, type DependencyRisk, type Member, type Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

const RISK: Record<DependencyRisk, { label: string; tone: Tone; stroke: string }> = {
  high: { label: '高風險', tone: 'red', stroke: '#DC2626' },
  mid: { label: '需等待', tone: 'orange', stroke: '#F97316' },
  ok: { label: '已滿足', tone: 'sky', stroke: '#9CA3AF' },
};

interface Props {
  tasks: Task[];
  dependencies: Dependency[];
  taskMap: Map<string, Task>;
  memberMap: Map<string, Member>;
  isLead: boolean;
}

const W = 188;
const H = 46;
const GAP_X = 64;
const GAP_Y = 14;

/** 依賴圖：任務為節點、箭頭由前置任務指向依賴它的任務，顏色代表風險；虛線框為上一個 Sprint 的任務 */
function Graph({ dependencies, taskMap }: Pick<Props, 'dependencies' | 'taskMap'>) {
  const layout = useMemo(() => {
    const level = dependencyLevels(dependencies);
    const columns = new Map<number, string[]>();
    [...level.entries()].forEach(([id, l]) => columns.set(l, [...(columns.get(l) ?? []), id]));
    const pos = new Map<string, { x: number; y: number }>();
    let rows = 1;
    columns.forEach((ids, l) => {
      ids.forEach((id, i) => pos.set(id, { x: l * (W + GAP_X), y: i * (H + GAP_Y) }));
      rows = Math.max(rows, ids.length);
    });
    const cols = Math.max(...[...columns.keys()], 0) + 1;
    return { pos, width: cols * W + (cols - 1) * GAP_X, height: rows * H + (rows - 1) * GAP_Y };
  }, [dependencies]);

  if (!dependencies.length) return null;
  const prevIds = new Set(dependencies.filter((d) => d.scope === 'prev').map((d) => d.dependsOnId));

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 p-3">
      <svg viewBox={`-4 -4 ${layout.width + 8} ${layout.height + 8}`} width={layout.width + 8} role="img" aria-label="任務依賴圖" className="max-w-none">
        <defs>
          {(Object.keys(RISK) as DependencyRisk[]).map((r) => (
            <marker key={r} id={`dep-${r}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill={RISK[r].stroke} />
            </marker>
          ))}
        </defs>
        {dependencies.map((d) => {
          const a = layout.pos.get(d.dependsOnId);
          const b = layout.pos.get(d.taskId);
          if (!a || !b) return null;
          const x1 = a.x + W;
          const y1 = a.y + H / 2;
          const x2 = b.x;
          const y2 = b.y + H / 2;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={`${d.taskId}-${d.dependsOnId}`}
              d={`M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`}
              fill="none"
              stroke={RISK[d.risk].stroke}
              strokeWidth={1.5}
              markerEnd={`url(#dep-${d.risk})`}
            />
          );
        })}
        {[...layout.pos.entries()].map(([id, p]) => {
          const t = taskMap.get(id);
          return (
            <g key={id} transform={`translate(${p.x} ${p.y})`}>
              <rect width={W} height={H} rx={10} fill="white" stroke="#9CA3AF" strokeWidth={1.25} strokeDasharray={prevIds.has(id) ? '4 3' : undefined} />
              <text x={12} y={19} fontSize={11} fill="#6B7280" fontFamily="ui-monospace, monospace">
                {id}
              </text>
              <text x={12} y={36} fontSize={12.5} fontWeight={600} fill="#111827">
                {(t?.title ?? '').length > 11 ? `${t?.title.slice(0, 11)}…` : t?.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Lane({
  title,
  hint,
  tone,
  items,
  taskMap,
  memberMap,
  action,
}: {
  title: string;
  hint: string;
  tone: Tone;
  items: GroupedTask[];
  taskMap: Map<string, Task>;
  memberMap: Map<string, Member>;
  action?: (t: Task) => React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-gray-50 p-3" aria-label={title}>
      <header className="mb-2 px-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          <Badge tone={tone} className="bg-white tabular-nums">
            {items.length}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      </header>
      <ul className="space-y-2">
        {items.map(({ task, deps }) => (
          <li key={task.id} className="rounded-2xl border border-gray-100 bg-white p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray-500">{task.id}</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-xs tabular-nums text-gray-500">
                <Avatar member={memberMap.get(task.assigneeId)} size="xs" />
                {task.storyPoints} SP
              </span>
            </div>
            <p className="mt-1 font-medium text-gray-900">{task.title}</p>
            {deps.map((d) => {
              const dep = taskMap.get(d.dependsOnId);
              return (
                <p key={d.dependsOnId} className="mt-1.5 text-xs text-gray-600">
                  <Badge tone={RISK[d.risk].tone} className="mr-1.5 h-5">
                    {RISK[d.risk].label}
                  </Badge>
                  依賴 <span className="font-medium">{d.dependsOnId}</span> {dep?.title}
                  {dep && `（${TASK_STATES[dep.state].label}）`}：{d.reason}
                </p>
              );
            })}
            {task.assigneeId && deps.length > 0 && (
              <p className="mt-1 text-xs text-gray-500">負責人 {mention(memberMap.get(task.assigneeId)?.name)} 會收到延後或調整的通知</p>
            )}
            {action?.(task)}
          </li>
        ))}
        {!items.length && <li className="px-2 py-3 text-center text-xs text-gray-400">沒有任務</li>}
      </ul>
    </section>
  );
}

/** G2：依賴圖與「可平行 / 需等待 / 建議延後」分組；Leader 可以延後任務，受影響的成員會收到通知並回覆 */
export function DependencyPanel({ tasks, dependencies, taskMap, memberMap, isLead }: Props) {
  const { deferTask } = usePlanningMutations();
  const groups = useMemo(() => groupTasks(tasks, dependencies), [tasks, dependencies]);

  if (!tasks.length)
    return <EmptyState icon={Sparkles} title="還沒有任務可以分析" description="AI 拆解完成後，會在這裡分析任務之間與上一個 Sprint 的相依性。" />;

  return (
    <div className="space-y-5">
      <Callout tone="ai" title="AI 相依性分析">
        {dependencies.length
          ? '依任務之間與上一個 Sprint 的相依性分組：可平行的任務優先安排；需等待的排在後面；前置任務已延後的建議一併延後。延後或調整會通知負責人，由他同意或提出異議。'
          : '沒有發現相依性，所有任務都可以平行開始。'}
      </Callout>
      <Graph dependencies={dependencies} taskMap={taskMap} />
      <div className="grid gap-3 lg:grid-cols-3">
        <Lane title="可平行" hint="可以同時開始，點數大的優先" tone="sky" items={groups.parallel} taskMap={taskMap} memberMap={memberMap} />
        <Lane title="需等待" hint="前置任務尚未完成，排在後面" tone="orange" items={groups.waiting} taskMap={taskMap} memberMap={memberMap} />
        <Lane
          title="建議延後"
          hint="前置任務已延後，無法如期開始"
          tone="red"
          items={groups.deferSuggest}
          taskMap={taskMap}
          memberMap={memberMap}
          action={(t) =>
            isLead && (EDITABLE_PLAN_STATES.includes(t.state) || t.state === 'PENDING_MEMBER') ? (
              <Button size="xs" className="mt-2" loading={deferTask.isPending} onClick={() => deferTask.mutate(t.id)}>
                延後此任務
              </Button>
            ) : null
          }
        />
      </div>
    </div>
  );
}
