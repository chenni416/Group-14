import { ChevronRight, Sparkles } from 'lucide-react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, CardHeader } from '@/components/ui';
import type { Tone } from '@/lib/constants';
import type { Sprint, Task, TaskState } from '@/types';

const STAGES: Array<{ label: string; tone: Tone; states: TaskState[] }> = [
  { label: 'Leader Approved', tone: 'orange', states: ['PENDING_MEMBER'] },
  { label: 'Returned', tone: 'red', states: ['RETURNED'] },
  { label: 'Member Accepted', tone: 'sky', states: ['ASSIGNED', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
];

interface Props {
  sprint: Pick<Sprint, 'name'> | undefined;
  tasks: Pick<Task, 'state'>[];
  canPlan: boolean;
}

export function PlanningProgress({ sprint, tasks, canPlan }: Props) {
  const navigate = useNavigate();
  const name = sprint?.name ?? '下個 Sprint';
  return (
    <Card>
      <CardHeader
        title={`${name} 規劃進度`}
        action={
          canPlan &&
          (sprint ? (
            <Button variant="primary" size="sm" onClick={() => navigate('/sprints/planning')}>
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
              Planning Studio
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={() => navigate('/sprints')}>
              Sprint 列表
            </Button>
          ))
        }
      />
      {tasks.length ? (
        <div className="flex flex-wrap items-center gap-3">
          {STAGES.map((s, i) => (
            <Fragment key={s.label}>
              {i > 0 && <ChevronRight className="hidden h-4 w-4 text-gray-300 sm:block" strokeWidth={1.75} aria-hidden />}
              <div className="min-w-[120px] flex-1 rounded-2xl border border-gray-100 p-4">
                <Badge tone={s.tone} dot>
                  {s.label}
                </Badge>
                <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
                  {tasks.filter((t) => s.states.includes(t.state)).length}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      ) : (
        <Callout>
          {!sprint
            ? canPlan
              ? '尚未建立下一個 Sprint。前往 Sprint 列表建立後即可開始規劃。'
              : '目前沒有規劃中的 Sprint。'
            : canPlan
              ? `${name} 尚未核准規劃。前往 Planning Studio 貼上會議紀錄，讓 AI 拆解成 Story 與 Task 後派工。`
              : `Leader 正在規劃 ${name}，核准後你會在「確認與認領」收到指派邀請。`}
        </Callout>
      )}
    </Card>
  );
}
