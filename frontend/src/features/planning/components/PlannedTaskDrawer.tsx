import { Plus, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Badge, Button, Callout, Drawer, Input, Label, SegmentedControl, Select } from '@/components/ui';
import { STORY_POINT_OPTIONS } from '@/lib/constants';
import { sum } from '@/lib/format';
import { REVIEWER_LABELS, policyToReviewer, reviewerSummary, reviewerToPolicy } from '@/lib/planning';
import type { Member, ReviewerAssignment, ReviewerMode, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { LANES, laneOf } from '../lanes';

interface Props {
  task: Task | null;
  /** 本 Sprint 所有已送出的任務，用來計算各成員負載 */
  sprintTasks: Task[];
  members: Member[];
  onClose: () => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section>
    <Label>{label}</Label>
    {children}
  </section>
);

interface FormState {
  title: string;
  storyPoints: number;
  acceptanceCriteria: string[];
  assigneeId: string;
  reviewer: ReviewerAssignment;
}

const toForm = (t: Task): FormState => ({
  title: t.title,
  storyPoints: t.storyPoints,
  acceptanceCriteria: [...t.acceptanceCriteria],
  assigneeId: t.assigneeId,
  reviewer: policyToReviewer(t.policy),
});

/**
 * 已送出任務的完整內容。
 * 待確認／已接受為唯讀；協商退回時開放編輯並「儲存並重新發送通知」，任務回到待確認。
 */
export function PlannedTaskDrawer({ task, sprintTasks, members, onClose }: Props) {
  const { revise } = usePlanningMutations();
  const [form, setForm] = useState<FormState | null>(task ? toForm(task) : null);
  const [newAc, setNewAc] = useState('');
  const memberMap = new Map(members.map((m) => [m.id, m]));

  useEffect(() => {
    setForm(task ? toForm(task) : null);
    setNewAc('');
  }, [task]);

  if (!task || !form) return null;

  const editable = task.state === 'RETURNED';
  const lane = LANES.find((l) => l.key === laneOf(task.state));
  const leaderId = members.find((m) => m.role === 'Leader')?.id;
  // 負載不含這張任務本身，選單中加上這張的點數
  const loadOf = (id: string) => sum(sprintTasks.filter((t) => t.assigneeId === id && t.id !== task.id).map((t) => t.storyPoints));
  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const addAc = () => {
    if (!newAc.trim()) return;
    set({ acceptanceCriteria: [...form.acceptanceCriteria, newAc.trim()] });
    setNewAc('');
  };
  const save = () =>
    revise.mutate(
      {
        id: task.id,
        input: {
          title: form.title,
          storyPoints: form.storyPoints,
          acceptanceCriteria: form.acceptanceCriteria.map((a) => a.trim()).filter(Boolean),
          assigneeId: form.assigneeId,
          policy: reviewerToPolicy(form.reviewer),
        },
      },
      { onSuccess: onClose },
    );

  const assignee = memberMap.get(task.assigneeId);

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={
        <>
          <span className="font-mono text-gray-500">{task.id}</span>
          {lane && (
            <Badge tone={lane.tone} dot>
              {lane.label}
            </Badge>
          )}
          {task.epic && <span className="text-gray-500">{task.epic}</span>}
        </>
      }
      title={editable ? '編輯與重新派工' : task.title}
      footer={
        editable ? (
          <>
            <Button onClick={onClose}>取消</Button>
            <Button variant="primary" loading={revise.isPending} onClick={save}>
              <Send className="h-4 w-4" strokeWidth={1.75} />
              儲存並重新發送通知
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>關閉</Button>
        )
      }
    >
      <div className="space-y-5">
        {editable && task.negotiation && (
          <Callout tone="danger" title={`${memberMap.get(task.negotiation.byId)?.name ?? '成員'} 的協商備註`}>
            {task.negotiation.reason}
            {task.negotiation.suggestId && `（建議改由 ${memberMap.get(task.negotiation.suggestId)?.name} 處理）`}
          </Callout>
        )}

        {editable && (
          <Field label="任務標題">
            <Input value={form.title} aria-label="任務標題" onChange={(e) => set({ title: e.target.value })} />
          </Field>
        )}

        <Field label="分支命名">
          <code className="block truncate rounded-xl bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-800">{task.branch}</code>
        </Field>

        <div className="grid gap-5 sm:grid-cols-[120px_1fr]">
          <Field label="評估點數">
            {editable ? (
              <Select aria-label="評估點數" value={form.storyPoints} onChange={(e) => set({ storyPoints: Number(e.target.value) })}>
                {STORY_POINT_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v} SP
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm font-semibold tabular-nums text-gray-900">{task.storyPoints} SP</p>
            )}
          </Field>
          <Field label="指派負責人">
            {editable ? (
              <Select aria-label="指派負責人" value={form.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {loadOf(m.id) + form.storyPoints}/{m.capacity} SP
                  </option>
                ))}
              </Select>
            ) : (
              <p className="flex items-center gap-2 text-sm text-gray-900">
                <Avatar member={assignee} size="xs" />
                {assignee?.name ?? '—'}
              </p>
            )}
          </Field>
        </div>

        <Field label="驗收條件">
          <ol className="space-y-1.5">
            {form.acceptanceCriteria.map((ac, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] tabular-nums text-gray-600">
                  {i + 1}
                </span>
                {editable ? (
                  <>
                    <input
                      value={ac}
                      aria-label={`驗收條件 ${i + 1}`}
                      onChange={(e) =>
                        set({ acceptanceCriteria: form.acceptanceCriteria.map((x, k) => (k === i ? e.target.value : x)) })
                      }
                      className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm text-gray-700 transition-colors duration-150 hover:border-gray-200 focus:border-gray-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      aria-label={`刪除驗收條件 ${i + 1}`}
                      onClick={() => set({ acceptanceCriteria: form.acceptanceCriteria.filter((_, k) => k !== i) })}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </>
                ) : (
                  <span className="text-sm text-gray-700">{ac}</span>
                )}
              </li>
            ))}
          </ol>
          {editable && (
            <div className="mt-2 flex items-center gap-2">
              <Plus className="ml-1 h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
              <input
                value={newAc}
                onChange={(e) => setNewAc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAc())}
                onBlur={addAc}
                placeholder="新增驗收條件後按 Enter"
                aria-label="新增驗收條件"
                className="min-w-0 flex-1 rounded-lg border border-dashed border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
              />
            </div>
          )}
        </Field>

        <Field label="審查人員">
          {editable ? (
            <>
              <SegmentedControl<ReviewerMode>
                size="sm"
                aria-label="審查方式"
                value={form.reviewer.mode}
                onChange={(mode) => set({ reviewer: { mode, memberId: mode === 'member' ? form.reviewer.memberId : null } })}
                options={(Object.keys(REVIEWER_LABELS) as ReviewerMode[]).map((m) => ({ value: m, label: REVIEWER_LABELS[m] }))}
              />
              {form.reviewer.mode === 'member' && (
                <Select
                  aria-label="指定審查成員"
                  className="mt-2"
                  value={form.reviewer.memberId ?? ''}
                  onChange={(e) => set({ reviewer: { mode: 'member', memberId: e.target.value || null } })}
                >
                  <option value="">選擇審查成員</option>
                  {members
                    .filter((m) => m.id !== form.assigneeId && m.id !== leaderId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.title}
                      </option>
                    ))}
                </Select>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-900">{reviewerSummary(policyToReviewer(task.policy), memberMap)}</p>
          )}
        </Field>

        {task.description && (
          <Field label="技術分析">
            <p className="text-sm leading-relaxed text-gray-600">{task.description}</p>
          </Field>
        )}
      </div>
    </Drawer>
  );
}
