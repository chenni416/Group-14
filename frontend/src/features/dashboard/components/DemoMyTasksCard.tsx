import { Check } from 'lucide-react';
import { Card, CardHeader, DomainIcon, EmptyState, SegmentedControl } from '@/components/ui';
import { TASK_STATES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { DemoTask } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import { useUiStore, type MyTasksTab } from '@/stores/ui.store';
import type { TaskState } from '@/types';

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

/** 示意專案用的「我的任務」：外觀與 MyTasksCard 相同，資料來自 project.store */
export function DemoMyTasksCard({ tasks, userId }: { tasks: DemoTask[]; userId: string }) {
  const { myTasksTab, setMyTasksTab } = useUiStore();

  const mine = tasks.filter((t) => t.assigneeId === userId);
  const list =
    myTasksTab === 'doing'
      ? mine.filter((t) => ['TODO', 'IN_PROGRESS', 'IN_REVIEW'].includes(t.state))
      : mine.filter((t) => t.state === 'PENDING_MEMBER');

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="我的任務" />
      <SegmentedControl<MyTasksTab> size="sm" options={TABS} value={myTasksTab} onChange={setMyTasksTab} aria-label="任務分類" />
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{list.length}</span>
        <span className="text-sm text-gray-500">{myTasksTab === 'doing' ? 'On Going Tasks' : 'Action Required'}</span>
      </div>
      <div className="mt-5 grid flex-1 content-start gap-3">
        {list.length ? (
          list.slice(0, 6).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toast('示意專案不提供任務詳情')}
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
            </button>
          ))
        ) : (
          <EmptyState icon={Check} title="目前沒有項目" description="可從右上角切換成其他成員查看" />
        )}
      </div>
    </Card>
  );
}