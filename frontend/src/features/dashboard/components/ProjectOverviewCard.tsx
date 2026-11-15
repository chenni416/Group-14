import { CalendarDays, Plus } from 'lucide-react';
import { AvatarStack, Badge, Card, CardHeader, IconButton, ProgressBar } from '@/components/ui';
import { sum } from '@/lib/format';
import { DEMO_PROJECTS, useProjectStore } from '@/stores/project.store';
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
  const currentId = useProjectStore((s) => s.currentId);
  const demo = DEMO_PROJECTS.find((p) => p.id === currentId);
  // Taskline 使用真實 mock 資料；其他專案使用寫死的 demo 資料
  const isMain = !demo || demo.id === 'taskline';

  const name = isMain ? project.name : demo.name;
  const prefix = isMain ? project.prefix : demo.prefix;
  const goal = isMain ? sprint?.goal : demo.goal;
  const total = isMain ? sum(tasks.map((t) => t.storyPoints)) : demo.total;
  const done = isMain ? sum(tasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints)) : demo.done;
  const endDate = isMain ? sprint?.endDate : demo.endDate;
  const shownMembers = isMain ? members : members.slice(0, demo.memberCount);
  const progressLabel = isMain ? `${sprint?.name ?? 'Sprint'} 進度` : '目前進度';

  const percent = total ? Math.round((done / total) * 100) : 0;
  const left = endDate ? daysLeft(endDate) : null;

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
        <h3 className="text-xl font-semibold tracking-tight text-gray-900">{name}</h3>
        <Badge>{prefix}</Badge>
      </div>

      {/* 目標 */}
      <p className="mb-6 text-sm text-gray-500">{goal || '尚未設定目標'}</p>

      {/* 進度條 */}
      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="text-gray-500">{progressLabel}</span>
          <span className="tabular-nums text-gray-900">
            {percent}%<span className="ml-2 text-gray-400">{done} / {total} SP</span>
          </span>
        </div>
        <ProgressBar value={done} max={total} tone="sky" size="lg" label="專案進度" />
      </div>

      {/* 參與人員與截止日 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AvatarStack members={shownMembers} size="sm" />
          <span className="text-sm tabular-nums text-gray-500">{shownMembers.length} 位成員</span>
        </div>
        {endDate && left !== null && (
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
            <span className="tabular-nums text-gray-900">{endDate}</span>
            <Badge tone={left < 0 ? 'orange' : 'sky'}>
              {left < 0 ? `已逾期 ${-left} 天` : left === 0 ? '今天截止' : `還剩 ${left} 天`}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
}