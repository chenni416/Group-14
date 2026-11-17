import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import type { Sprint, Task } from '@/types';
import { useStartSprint } from '../hooks/useStartSprint';

interface Props {
  sprint: Sprint;
  tasks: Task[];
  ready: boolean;
  canStart: boolean;
}

export function SprintBanner({ sprint, tasks, ready, canStart }: Props) {
  const navigate = useNavigate();
  const start = useStartSprint();
  const accepted = tasks.filter((t) => t.state === 'ASSIGNED').length;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl bg-neutral-900 p-5 text-white">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <Play className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="font-medium">{sprint.name} 準備中</div>
        <div className="text-sm tabular-nums text-gray-400">
          {accepted}/{tasks.length} 項任務已被成員接受{ready ? '，可以啟動了' : ''}
        </div>
      </div>
      {ready ? (
        <Button
          className="border-white bg-white text-gray-900 hover:bg-gray-100"
          disabled={!canStart}
          loading={start.isPending}
          title={canStart ? undefined : '只有 Leader 可以啟動 Sprint'}
          onClick={() => start.mutate(sprint.id)}
        >
          Start {sprint.name}
        </Button>
      ) : canStart ? (
        <Button className="border-white bg-white text-gray-900 hover:bg-gray-100" onClick={() => navigate('/sprints/planning')}>
          查看規劃
        </Button>
      ) : null}
    </div>
  );
}
