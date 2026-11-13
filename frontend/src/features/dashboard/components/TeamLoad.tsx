import { Avatar, Card, CardHeader, ProgressBar } from '@/components/ui';
import { sum } from '@/lib/format';
import type { Member, Sprint, Task } from '@/types';

export function TeamLoad({ members, tasks, sprint }: { members: Member[]; tasks: Task[]; sprint: Sprint | undefined }) {
  return (
    <Card>
      <CardHeader title="團隊負載" description={`${sprint?.name ?? ''} 剩餘 SP / Capacity`} />
      <div className="divide-y divide-gray-100">
        {members.map((m) => {
          const load = sum(tasks.filter((t) => t.assigneeId === m.id && t.state !== 'DONE').map((t) => t.storyPoints));
          const over = load > m.capacity;
          return (
            <div key={m.id} className="py-3 first:pt-0 last:pb-0">
              <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar member={m} size="xs" />
                  <span className="truncate text-gray-900">{m.name}</span>
                  <span className="hidden truncate text-xs text-gray-500 sm:inline">{m.title}</span>
                </span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  <span className={over ? 'font-semibold text-red-600' : 'font-semibold text-gray-900'}>{load}</span> / {m.capacity} SP
                </span>
              </div>
              <ProgressBar value={load} max={m.capacity} tone={over ? 'red' : 'dark'} size="sm" label={`${m.name} 負載`} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
