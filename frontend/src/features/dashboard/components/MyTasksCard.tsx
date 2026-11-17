import { Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, DomainIcon, EmptyState, IconButton, SegmentedControl } from '@/components/ui';
import { TASK_STATES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { needsMyReview } from '@/lib/permissions';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { useUiStore, type MyTasksTab } from '@/stores/ui.store';
import { formatDay, nextChecklistItem, nextCheckpoint } from '@/lib/execution';
import type { ExecutionPlan, Task, TaskState } from '@/types';

const SOFT: Partial<Record<TaskState, string>> = {
  IN_PROGRESS: 'bg-orange-50',
  IN_REVIEW: 'bg-violet-50',
  PENDING_MEMBER: 'bg-orange-50',
  TODO: 'bg-sky-50',
};

const TABS = [
  { value: 'doing' as const, label: '進行中' },
  { value: 'todo' as const, label: '待我處理' },
];

export function MyTasksCard({ tasks, userId, plans }: { tasks: Task[]; userId: string; plans: ExecutionPlan[] }) {
  const navigate = useNavigate();
  const drawer = useTaskDrawer();
  const { myTasksTab, setMyTasksTab } = useUiStore();

  const list =
    myTasksTab === 'doing'
      ? tasks.filter((t) => t.assigneeId === userId && ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.state))
      : tasks.filter((t) => (t.assigneeId === userId && t.state === 'PENDING_MEMBER') || needsMyReview(t, userId));

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="我的任務"
        action={
          <IconButton aria-label="前往 Sprint 規劃" onClick={() => navigate('/sprints/planning')}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        }
      />
      <SegmentedControl<MyTasksTab> size="sm" options={TABS} value={myTasksTab} onChange={setMyTasksTab} aria-label="任務分類" />
      <button
        type="button"
        onClick={() => navigate(myTasksTab === 'doing' ? '/board' : '/inbox')}
        className="mt-5 flex items-baseline gap-2 text-left transition-colors duration-150 hover:text-gray-600"
      >
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{list.length}</span>
        <span className="text-sm text-gray-500">{myTasksTab === 'doing' ? 'On Going Tasks' : 'Action Required'}</span>
      </button>
      <div className="mt-5 grid flex-1 content-start gap-3">
        {list.length ? (
          list.slice(0, 6).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => drawer.open(t.id)}
              className={cn(
                'rounded-2xl p-4 text-left transition-colors duration-150 hover:bg-gray-100',
                SOFT[t.state] ?? 'bg-gray-50',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700">
                  <DomainIcon domain={t.domain} />
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              </div>
              <div className="mt-3 text-sm font-medium text-gray-900">{t.title}</div>
              <div className="mt-1 text-xs tabular-nums text-gray-500">
                {t.id} · {TASK_STATES[t.state].label} · {t.storyPoints} SP
              </div>
              {(() => {
                // G3：讓成員一眼知道下一步，以及下一個階段性成果何時到期
                const plan = plans.find((p) => p.taskId === t.id && p.confirmedAt);
                const next = nextChecklistItem(plan);
                const cp = nextCheckpoint(plan);
                if (t.assigneeId !== userId || !plan || (!next && !cp)) return null;
                return (
                  <div className="mt-2 space-y-0.5 border-t border-white/70 pt-2 text-xs text-gray-600">
                    {next && <div>下一步：{next.text}</div>}
                    {cp && (
                      <div className="tabular-nums">
                        Checkpoint：{cp.title} · {formatDay(cp.dueAt)}
                      </div>
                    )}
                  </div>
                );
              })()}
            </button>
          ))
        ) : (
          <EmptyState icon={Check} title="目前沒有項目" description="可從右上角切換成其他成員查看" />
        )}
      </div>
    </Card>
  );
}
