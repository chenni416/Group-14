import { ChevronRight, Sparkles } from 'lucide-react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Callout, Card, CardHeader } from '@/components/ui';
import type { Tone } from '@/lib/constants';
import type { Sprint, Task, TaskState } from '@/types';

const STAGES: Array<{ label: string; tone: Tone; states: TaskState[] }> = [
  { label: 'AI Suggestion', tone: 'violet', states: ['AI_DRAFT', 'DRAFT'] },
  { label: 'Leader Approved', tone: 'orange', states: ['PENDING_MEMBER'] },
  { label: 'Returned', tone: 'red', states: ['RETURNED'] },
  { label: 'Member Accepted', tone: 'sky', states: ['ASSIGNED', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
];

export function PlanningProgress({ sprint, tasks }: { sprint: Sprint | undefined; tasks: Task[] }) {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader
        title={`${sprint?.name ?? '下個 Sprint'} 規劃進度`}
        action={
          <Button variant="primary" size="sm" onClick={() => navigate('/planning')}>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            Planning Studio
          </Button>
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
          尚未拆解 {sprint?.name ?? '下個 Sprint'} 的會議紀錄。前往 Planning Studio 貼上會議紀錄，讓 AI 拆解成 Epic、Story 與 Sub-task。
        </Callout>
      )}
    </Card>
  );
}
