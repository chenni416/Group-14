import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Card, CardHeader, Textarea } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { NEGOTIATE_TARGETS, TASK_STATES } from '@/lib/constants';
import { blockedBy } from '@/lib/execution';
import { mention, relativeTime } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import { api } from '@/services';
import { EDITABLE_PLAN_STATES, type Member, type Task } from '@/types';

interface Props {
  task: Task;
  me: Member;
  members: Map<string, Member>;
  taskMap: Map<string, Task>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

/** G1：任務目標、範圍、責任與交付成果；G2：前置任務；協商與延後回覆紀錄 */
export function TaskScope({ task, me, members, taskMap }: Props) {
  const assignee = members.get(task.assigneeId);
  const blocked = blockedBy(task, taskMap);
  const canEdit = isLead(me) && EDITABLE_PLAN_STATES.includes(task.state);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ scope: task.scope, outOfScope: task.outOfScope, responsibility: task.responsibility, deliverables: task.deliverables.join('\n') });
  const update = useApiMutation({
    mutationFn: (patch: Parameters<typeof api.tasks.update>[1]) => api.tasks.update(task.id, patch),
    invalidate: [['tasks']],
  });

  useEffect(() => {
    setDraft({ scope: task.scope, outOfScope: task.outOfScope, responsibility: task.responsibility, deliverables: task.deliverables.join('\n') });
  }, [task.id, task.scope, task.outOfScope, task.responsibility, task.deliverables]);

  const save = () =>
    update.mutate(
      {
        scope: draft.scope.trim(),
        outOfScope: draft.outOfScope.trim(),
        responsibility: draft.responsibility.trim(),
        deliverables: draft.deliverables.split('\n').map((l) => l.trim()).filter(Boolean),
      },
      { onSuccess: () => setEditing(false) },
    );

  return (
    <Card className="space-y-4 p-5">
      <CardHeader
        title="目標與範圍"
        description="Task Goal、Scope、Responsibility 與 Deliverables"
        className="mb-0"
        action={
          canEdit &&
          !editing && (
            <Button size="xs" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
              編輯
            </Button>
          )
        }
      />
      <Section label="任務目標">{task.description}</Section>

      {editing ? (
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-500">
            範圍（做什麼）
            <Textarea rows={2} className="mt-1.5 font-normal" value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            範圍外（不做什麼）
            <Textarea rows={2} className="mt-1.5 font-normal" value={draft.outOfScope} onChange={(e) => setDraft({ ...draft, outOfScope: e.target.value })} />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            責任
            <Textarea rows={2} className="mt-1.5 font-normal" value={draft.responsibility} onChange={(e) => setDraft({ ...draft, responsibility: e.target.value })} />
          </label>
          <label className="block text-xs font-medium text-gray-500">
            交付成果（一行一項）
            <Textarea rows={3} className="mt-1.5 font-normal" value={draft.deliverables} onChange={(e) => setDraft({ ...draft, deliverables: e.target.value })} />
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setEditing(false)}>
              取消
            </Button>
            <Button size="sm" variant="primary" loading={update.isPending} onClick={save}>
              儲存
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Section label="範圍">{task.scope}</Section>
          <Section label="範圍外">{task.outOfScope}</Section>
          <Section label="負責人與責任">
            <div className="mb-1 flex items-center gap-2">
              <Avatar member={assignee} size="xs" />
              {assignee?.name ?? '尚未指派'}
            </div>
            {task.responsibility}
          </Section>
          <Section label="交付成果">
            <ul className="list-disc space-y-0.5 pl-5">
              {task.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {task.dependsOn.length > 0 && (
        <Section label="前置任務">
          <ul className="space-y-1">
            {task.dependsOn.map(({ id, reason }) => {
              const dep = taskMap.get(id);
              const waiting = dep && dep.state !== 'DONE';
              return (
                <li key={id}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{id}</span>
                    <span>{dep?.title ?? '（找不到任務）'}</span>
                    {dep && <Badge tone={waiting ? 'orange' : 'sky'}>{waiting ? `尚未完成 · ${TASK_STATES[dep.state].label}` : '已完成'}</Badge>}
                  </span>
                  {reason && <span className="mt-0.5 block text-xs text-gray-500">{reason}</span>}
                </li>
              );
            })}
          </ul>
          {blocked.length > 0 && <p className="mt-1 text-xs text-orange-700">有 {blocked.length} 項前置任務尚未完成，執行時留意進度。</p>}
        </Section>
      )}

      {task.negotiation && (
        <Section label="協商紀錄">
          <div className="rounded-xl bg-red-50 px-3 py-2 text-red-800">
            {mention(members.get(task.negotiation.byId)?.name)} 針對「{NEGOTIATE_TARGETS[task.negotiation.target ?? 'other']}」提出：{task.negotiation.reason}
          </div>
        </Section>
      )}

      {task.planConfirms.length > 0 && (
        <Section label="延後或調整的回覆">
          <ul className="space-y-1">
            {task.planConfirms.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Badge tone={c.status === 'agree' ? 'sky' : 'red'}>{c.status === 'agree' ? '同意' : '異議'}</Badge>
                <span>{mention(members.get(c.memberId)?.name)}</span>
                {c.note && <span className="text-gray-600">{c.note}</span>}
                <span className="text-xs text-gray-500">{relativeTime(c.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Card>
  );
}
