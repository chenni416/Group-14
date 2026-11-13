import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Badge, Button, Callout, IconButton, Input, Label, Select, StatusBadge, Tag, Textarea } from '@/components/ui';
import { DOMAINS, REVIEW_POLICIES, STORY_POINT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { mention } from '@/lib/format';
import { DRAFT_STATES, type Member, type Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

interface Props {
  task: Task;
  members: Member[];
  memberMap: Map<string, Member>;
  load: Record<string, number>;
  isLead: boolean;
}

export function DraftTaskCard({ task, members, memberMap, load, isLead }: Props) {
  const { updateTask, removeTask, reassign } = usePlanningMutations();
  const editable = DRAFT_STATES.includes(task.state) && isLead;
  const [title, setTitle] = useState(task.title);
  const [ac, setAc] = useState(task.acceptanceCriteria.join('\n'));
  const [reassignTo, setReassignTo] = useState(task.negotiation?.suggestId ?? '');
  const name = (id: string | null | undefined) => mention(memberMap.get(id ?? '')?.name);
  const update = (patch: Parameters<typeof updateTask.mutate>[0]['patch']) => updateTask.mutate({ id: task.id, patch });

  return (
    <article
      className={cn(
        'rounded-2xl border bg-white p-4',
        task.state === 'AI_DRAFT' && 'border-violet-200',
        task.state === 'RETURNED' && 'border-red-200',
        !['AI_DRAFT', 'RETURNED'].includes(task.state) && 'border-gray-100',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500">{task.id}</span>
        {task.origin === 'ai' ? (
          task.state !== 'AI_DRAFT' && (
            <Badge tone="violet">
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              AI Generated
            </Badge>
          )
            ) : (
          <Tag>手動新增</Tag>
        )}
        {task.edited && <Tag>Leader 已調整</Tag>}
        <StatusBadge state={task.state} />
        {editable && (
          <IconButton aria-label="移除任務" size="sm" variant="ghost" className="ml-auto" onClick={() => removeTask.mutate(task.id)}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {editable ? (
            <Input
              value={title}
              aria-label="任務標題"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && update({ title: title.trim() })}
              className="font-medium"
            />
          ) : (
            <p className="text-sm font-medium text-gray-900">{task.title}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Tag className="border-gray-900 text-gray-900">{DOMAINS[task.domain].label}</Tag>
            {task.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600 marker:text-gray-300">
            {task.acceptanceCriteria.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          {editable && (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-900">編輯驗收條件</summary>
              <Textarea
                rows={4}
                className="mt-2 text-xs"
                value={ac}
                aria-label="驗收條件"
                onChange={(e) => setAc(e.target.value)}
                onBlur={() =>
                  update({ acceptanceCriteria: ac.split('\n').map((s) => s.trim()).filter(Boolean) })
                }
              />
            </details>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor={`sp-${task.id}`}>Story Points</Label>
            <div className="flex items-center gap-2">
              <Select
                id={`sp-${task.id}`}
                className="w-20"
                value={task.storyPoints}
                disabled={!editable}
                onChange={(e) => update({ storyPoints: Number(e.target.value) })}
              >
                {STORY_POINT_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
              {task.storyPointsReason && <span className="text-xs text-gray-500">{task.storyPointsReason}</span>}
            </div>
          </div>
          <div>
            <Label htmlFor={`as-${task.id}`}>指派</Label>
            <div className="flex items-center gap-2">
              <Avatar member={memberMap.get(task.assigneeId)} size="sm" />
              <Select
                id={`as-${task.id}`}
                className="flex-1"
                value={task.assigneeId}
                disabled={!editable}
                onChange={(e) => update({ assigneeId: e.target.value })}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {load[m.id] ?? 0}/{m.capacity} SP
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {task.suggestReason && (
            <Callout tone="ai" title="AI Suggested Assignee" className="text-xs">
              建議指派 {name(task.suggestedAssigneeId)}，因為{task.suggestReason}
              {task.assigneeId !== task.suggestedAssigneeId && (
                <div className="mt-1 text-gray-500">Leader 已改派給 {name(task.assigneeId)}</div>
              )}
            </Callout>
          )}
          <p className="text-xs text-gray-500">
            Review：<span className="font-medium text-gray-900">{REVIEW_POLICIES[task.policy.mode].label}</span>
            {task.policyReason && ` · ${task.policyReason}`}
          </p>
        </div>
      </div>

      {task.state === 'RETURNED' && task.negotiation && (
        <Callout tone="danger" className="mt-4">
          <span className="font-medium">{name(task.negotiation.byId)} 提出協商：</span>
          {task.negotiation.reason}
          {task.negotiation.suggestId && `（建議改由 ${name(task.negotiation.suggestId)} 處理）`}
          {isLead && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Select
                aria-label="重新指派給"
                className="w-44"
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
              >
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
              <Button
                variant="primary"
                size="md"
                disabled={!reassignTo}
                loading={reassign.isPending}
                onClick={() => reassign.mutate({ id: task.id, assigneeId: reassignTo })}
              >
                重新指派並發送
              </Button>
            </div>
          )}
        </Callout>
      )}
    </article>
  );
}
