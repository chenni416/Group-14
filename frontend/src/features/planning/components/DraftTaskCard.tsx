import { CalendarClock, Layers, Link2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Callout, IconButton, Input, Label, Select, StatusBadge, Tag, Textarea } from '@/components/ui';
import { DOMAINS, REVIEW_POLICIES, STORY_POINT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { mention } from '@/lib/format';
import { capOf, reviewerText, taskProblems } from '@/lib/planning';
import { EDITABLE_PLAN_STATES, type Member, type Sprint, type Task, type UpdateTaskInput } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { EditableField } from './EditableField';
import { ReviewPolicyEditor } from './ReviewPolicyEditor';

interface Props {
  task: Task;
  sprint: Sprint;
  members: Member[];
  memberMap: Map<string, Member>;
  load: Record<string, number>;
  isLead: boolean;
  leaderName?: string;
  /** 核准前檢查後，以紅框標出問題 */
  flagged: boolean;
  onShowSource: (source: string) => void;
}

const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);

export function DraftTaskCard({ task, sprint, members, memberMap, load, isLead, leaderName, flagged, onShowSource }: Props) {
  const { updateTask, removeTask, deferTask } = usePlanningMutations();
  const editable = EDITABLE_PLAN_STATES.includes(task.state) && isLead;
  const acText = task.acceptanceCriteria.join('\n');
  const [title, setTitle] = useState(task.title);
  const [ac, setAc] = useState(acText);
  const [reason, setReason] = useState(task.storyPointsReason);
  useEffect(() => setTitle(task.title), [task.title]);
  useEffect(() => setAc(acText), [acText]);
  useEffect(() => setReason(task.storyPointsReason), [task.storyPointsReason]);

  const update = (patch: UpdateTaskInput) => updateTask.mutate({ id: task.id, patch });
  const name = (id: string | null | undefined) => mention(memberMap.get(id ?? '')?.name);
  const assignee = memberMap.get(task.assigneeId);
  const over = !!assignee && (load[assignee.id] ?? 0) > capOf(sprint, assignee);
  const problems = editable ? taskProblems(task) : [];
  const showFlag = flagged && editable && (problems.length > 0 || over);

  return (
    <article
      id={`task-${task.id}`}
      className={cn(
        'rounded-2xl border bg-white p-4',
        showFlag ? 'border-red-400 ring-4 ring-red-50' : task.state === 'AI_DRAFT' ? 'border-violet-200' : task.state === 'RETURNED' ? 'border-red-200' : 'border-gray-100',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500">{task.id}</span>
        {task.origin === 'ai' ? (
          <Badge tone="violet">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            {task.state === 'AI_DRAFT' ? 'AI Draft' : 'AI Generated'}
          </Badge>
        ) : (
          <Tag>Leader 新增</Tag>
        )}
        {task.edited && task.origin === 'ai' && <Tag className="border-blue-200 text-blue-700">Leader 已調整</Tag>}
        {task.carryTag && <Badge tone="orange">延續事項 · {task.carryTag === 'multi' ? '跨 Sprint' : '延後'}</Badge>}
        {task.multiSprint && <Badge tone="violet">跨 Sprint</Badge>}
        {task.clarified && <Badge tone="violet">已套用釐清回答</Badge>}
        <StatusBadge state={task.state} />
        {editable && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button size="xs" onClick={() => update({ multiSprint: !task.multiSprint })} title="需要延續一個 Sprint 以上">
              <Layers className="h-3 w-3" strokeWidth={1.75} />
              {task.multiSprint ? '取消跨 Sprint' : '標記跨 Sprint'}
            </Button>
            <Button size="xs" loading={deferTask.isPending} onClick={() => deferTask.mutate(task.id)}>
              <CalendarClock className="h-3 w-3" strokeWidth={1.75} />
              延後到下個 Sprint
            </Button>
            <IconButton aria-label="移除任務" size="sm" variant="ghost" onClick={() => removeTask.mutate(task.id)}>
              <X className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          {editable ? (
            <EditableField label="標題">
              <Input
                value={title}
                aria-label="任務標題"
                className="font-medium"
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title.trim() !== task.title && update({ title: title.trim() })}
              />
            </EditableField>
          ) : (
            <p className="text-sm font-medium text-gray-900">{task.title}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Tag className="border-gray-900 text-gray-900">{DOMAINS[task.domain].label}</Tag>
            {task.tags.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
          {editable ? (
            <EditableField label="驗收條件（每行一條）">
              <Textarea
                rows={Math.max(3, task.acceptanceCriteria.length + 1)}
                className="text-xs"
                value={ac}
                aria-label="驗收條件"
                onChange={(e) => setAc(e.target.value)}
                onBlur={() => ac !== acText && update({ acceptanceCriteria: lines(ac) })}
              />
            </EditableField>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-600 marker:text-gray-300">
              {task.acceptanceCriteria.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
          {task.source ? (
            <button
              type="button"
              onClick={() => onShowSource(task.source)}
              className="flex w-full items-start gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-amber-400 hover:bg-amber-50"
            >
              <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span>
                <span className="font-medium text-gray-900">來源句：</span>
                {task.source}
              </span>
            </button>
          ) : (
            <p className="text-xs text-gray-400">沒有來源句</p>
          )}
        </div>

        <div className="space-y-3">
          {editable ? (
            <EditableField label="點數與估點理由">
              <div className="flex gap-2">
                <Select
                  aria-label="Story Points"
                  className="w-20 shrink-0"
                  value={task.storyPoints}
                  onChange={(e) => update({ storyPoints: Number(e.target.value) })}
                >
                  {STORY_POINT_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="估點理由"
                  className="text-xs"
                  placeholder="估點理由"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => reason !== task.storyPointsReason && update({ storyPointsReason: reason })}
                />
              </div>
            </EditableField>
          ) : (
            <div>
              <Label>Story Points</Label>
              <p className="text-sm">
                <span className="font-semibold">{task.storyPoints} SP</span>
                {task.storyPointsReason && <span className="ml-2 text-xs text-gray-500">{task.storyPointsReason}</span>}
              </p>
            </div>
          )}

          {editable ? (
            <EditableField label="負責人">
              <div className="flex items-center gap-2">
                <Avatar member={assignee} size="sm" muted={!assignee} />
                <Select
                  aria-label="負責人"
                  className="flex-1"
                  value={task.assigneeId}
                  onChange={(e) => update({ assigneeId: e.target.value })}
                >
                  <option value="">未指派</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {load[m.id] ?? 0}/{capOf(sprint, m)} SP
                    </option>
                  ))}
                </Select>
              </div>
            </EditableField>
          ) : (
            <div>
              <Label>負責人</Label>
              <div className="flex items-center gap-2 text-sm">
                <Avatar member={assignee} size="xs" />
                {assignee?.name ?? '未指派'}
              </div>
            </div>
          )}

          {task.suggestReason && (
            <Callout tone="ai" title="AI 建議負責人" className="text-xs">
              建議指派 {name(task.suggestedAssigneeId)}，因為{task.suggestReason}
              {task.assigneeId !== task.suggestedAssigneeId && (
                <div className="mt-1 text-gray-500">Leader 已改派給 {task.assigneeId ? name(task.assigneeId) : '（未指派）'}</div>
              )}
            </Callout>
          )}

          {editable ? (
            <EditableField label="Review 策略與審查人員">
              <ReviewPolicyEditor
                id={`policy-${task.id}`}
                value={task.policy}
                members={members}
                assigneeId={task.assigneeId}
                leaderName={leaderName}
                onChange={(policy) => update({ policy })}
              />
            </EditableField>
          ) : (
            <div>
              <Label>Review 策略</Label>
              <p className="text-sm font-medium">{REVIEW_POLICIES[task.policy.mode].label}</p>
              <p className="text-xs text-gray-500">{reviewerText(task.policy, new Map(members.map((m) => [m.id, m.name])), leaderName)}</p>
            </div>
          )}
          {task.policyReason && (
            <p className="flex items-start gap-1 text-xs text-violet-700">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
              {task.policyReason}
            </p>
          )}
        </div>
      </div>

      {showFlag && (
        <p className="mt-3 text-xs font-semibold text-red-600">
          {[...problems, over ? `${assignee?.name} 超過點數上限` : ''].filter(Boolean).join('、')}
        </p>
      )}
    </article>
  );
}
