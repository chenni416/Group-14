import { CalendarDays, Plus } from 'lucide-react';
import { AvatarStack, Badge, Card, CardHeader, IconButton, ProgressBar } from '@/components/ui';
import { sum } from '@/lib/format';
import { toast } from '@/stores/toast.store';
import type { Member, Project, Sprint, Task } from '@/types';

interface Props {
  project: Project;
  sprint: Sprint | undefined;
  tasks: Task[];
  members: Member[];
}

/** 計算距離截止日還有幾天（負數代表已逾期） */
function daysLeft(endDate: string): number {
  const end = new Date(`${endDate}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}

export function ProjectOverviewCard({ project, sprint, tasks, members }: Props) {
  const total = sum(tasks.map((t) => t.storyPoints));
  const done = sum(tasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const percent = total ? Math.round((done / total) * 100) : 0;
  const left = sprint ? daysLeft(sprint.endDate) : null;

  return (
    <Card>
      <CardHeader
        title="進行中的專案"
        action={
          <IconButton aria-label="新增專案" size="sm" onClick={() => toast('新增專案功能開發中')}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        }
      />

      {/* 專案名稱與代碼 */}
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-gray-900">{project.name}</h3>
        <Badge>{project.prefix}</Badge>
      </div>

      {/* 目標：目前先使用進行中 Sprint 的 Goal */}
      <p className="mb-6 text-sm text-gray-500">{sprint?.goal || '尚未設定目標'}</p>

      {/* 進度條 */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-gray-500">{sprint?.name ?? 'Sprint'} 進度</span>
          <span className="tabular-nums text-gray-900">
            {percent}%<span className="ml-2 text-gray-400">{done} / {total} SP</span>
          </span>
        </div>
        <ProgressBar value={done} max={total} tone="sky" size="lg" label="專案進度" />
      </div>

      {/* 參與人員與截止日 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AvatarStack members={members} size="sm" />
          <span className="text-sm tabular-nums text-gray-500">{members.length} 位成員</span>
        </div>
        {sprint && left !== null && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
            <span className="tabular-nums text-gray-900">{sprint.endDate}</span>
            <Badge tone={left < 0 ? 'orange' : 'sky'}>
              {left < 0 ? `已逾期 ${-left} 天` : left === 0 ? '今天截止' : `還剩 ${left} 天`}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}