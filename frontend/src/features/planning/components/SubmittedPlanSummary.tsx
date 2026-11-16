import { Play } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Callout, Card, CardHeader, Select } from '@/components/ui';
import { useStartSprint } from '@/features/board/hooks/useStartSprint';
import { mention } from '@/lib/format';
import type { Member, Sprint, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

function ReturnedTask({ task, members }: { task: Task; members: Member[] }) {
  const { reassign } = usePlanningMutations();
  const [to, setTo] = useState(task.negotiation?.suggestId ?? '');
  const name = (id: string | null | undefined) => mention(members.find((m) => m.id === id)?.name);
  return (
    <Callout tone="danger">
      <div className="font-medium">
        {task.id} · {task.title}
      </div>
      <div className="mt-1">
        {name(task.negotiation?.byId)} 提出協商：{task.negotiation?.reason}
        {task.negotiation?.suggestId && `（建議改由 ${name(task.negotiation.suggestId)} 處理）`}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Select aria-label="重新指派給" className="w-44" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="" disabled>
            選擇成員
          </option>
          {members
            .filter((m) => m.id !== task.negotiation?.byId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
        <Button variant="primary" disabled={!to} loading={reassign.isPending} onClick={() => reassign.mutate({ id: task.id, assigneeId: to })}>
          重新指派並發送
        </Button>
      </div>
    </Callout>
  );
}

/** 規劃已核准送出後：追蹤成員確認狀態、處理協商退回、啟動 Sprint */
export function SubmittedPlanSummary({ sprint, tasks, members, ready }: { sprint: Sprint; tasks: Task[]; members: Member[]; ready: boolean }) {
  const start = useStartSprint();
  const count = (s: Task['state']) => tasks.filter((t) => t.state === s).length;
  const returned = tasks.filter((t) => t.state === 'RETURNED');

  return (
    <Card>
      <CardHeader title="已送出的規劃" description={`${tasks.length} 張 Task 已發送指派邀請`} />
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ['待確認', count('PENDING_MEMBER'), 'orange'],
          ['協商退回', count('RETURNED'), 'red'],
          ['已接受', count('ASSIGNED'), 'sky'],
        ].map(([label, v, tone]) => (
          <div key={label as string} className="rounded-2xl border border-gray-100 p-4">
            <Badge tone={tone as 'orange'} dot>
              {label}
            </Badge>
            <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{v}</div>
          </div>
        ))}
      </div>
      {returned.length > 0 && (
        <div className="mb-5 space-y-3">
          {returned.map((t) => (
            <ReturnedTask key={t.id} task={t} members={members} />
          ))}
        </div>
      )}
      {ready ? (
        <Button variant="primary" loading={start.isPending} onClick={() => start.mutate(sprint.id)}>
          <Play className="h-4 w-4" strokeWidth={1.75} />
          所有任務已被接受，Start {sprint.name}
        </Button>
      ) : (
        <Callout>成員在「確認與認領」接受全部任務後，即可在這裡啟動 Sprint。</Callout>
      )}
    </Card>
  );
}
