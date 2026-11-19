import { Check, ClipboardList, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NegotiateDialog } from '@/components/domain/NegotiateDialog';
import { Avatar, Badge, Button, Callout, Card, CardHeader, EmptyState, Input, PageHeader, PageSkeleton, ProgressBar, StatusBadge, Textarea } from '@/components/ui';
import { useCurrentUser, useMemberMap, useSprintContext, useSprints } from '@/hooks/queries';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { useDisclosure } from '@/hooks/useDisclosure';
import { NEGOTIATE_TARGETS } from '@/lib/constants';
import { mention, relativeTime } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import { useOnboardingMutations } from '@/features/onboarding/hooks/useOnboarding';
import type { Member, Task } from '@/types';

const HIDDEN = ['AI_DRAFT', 'DRAFT', 'DEFERRED'];
const CONFIRMED = ['ASSIGNED', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

function BriefTask({ task, me, memberMap, onNegotiate }: { task: Task; me: Member; memberMap: Map<string, Member>; onNegotiate: (t: Task) => void }) {
  const drawer = useTaskDrawer();
  const { accept } = useTaskActions();
  const assignee = memberMap.get(task.assigneeId);
  const mine = task.assigneeId === me.id;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500">{task.id}</span>
        <StatusBadge state={task.state} />
        <span className="ml-auto text-xs tabular-nums text-gray-500">{task.storyPoints} SP</span>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-gray-900">{task.title}</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="任務目標">{task.description}</Field>
        <Field label="範圍">{task.scope}</Field>
        <Field label="範圍外">{task.outOfScope}</Field>
        <Field label="負責人與責任">
          <div className="mb-1 flex items-center gap-2">
            <Avatar member={assignee} size="xs" />
            {assignee?.name ?? '尚未指派'}
          </div>
          {task.responsibility}
        </Field>
        <Field label="交付成果">
          <ul className="list-disc space-y-0.5 pl-5">
            {task.deliverables.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </Field>
        <Field label="驗收條件">
          <ol className="list-decimal space-y-0.5 pl-5">
            {task.acceptanceCriteria.map((ac) => (
              <li key={ac}>{ac}</li>
            ))}
          </ol>
        </Field>
      </div>

      {task.negotiation && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {mention(memberMap.get(task.negotiation.byId)?.name)} 針對「{NEGOTIATE_TARGETS[task.negotiation.target ?? 'other']}」提出協商：{task.negotiation.reason}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
        {mine && task.state === 'PENDING_MEMBER' ? (
          <>
            <Button variant="primary" size="sm" loading={accept.isPending} onClick={() => accept.mutate(task.id)}>
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              我已理解並接受
            </Button>
            <Button size="sm" onClick={() => onNegotiate(task)}>
              協商（範圍、驗收條件、工時、負責人）
            </Button>
          </>
        ) : task.state === 'PENDING_MEMBER' ? (
          <Badge tone="orange" dot>
            等待 {assignee?.name ?? '負責人'} 確認
          </Badge>
        ) : CONFIRMED.includes(task.state) ? (
          <Badge tone="sky" dot>
            已確認
          </Badge>
        ) : task.state === 'RETURNED' ? (
          <Badge tone="red" dot>
            協商中，等待 Leader 調整
          </Badge>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => drawer.open(task.id, 'spec')}>
          查看詳情
        </Button>
      </div>
    </Card>
  );
}

function DeferredRow({ task, me, memberMap }: { task: Task; me: Member; memberMap: Map<string, Member> }) {
  const { confirmPlan } = useTaskActions();
  const [note, setNote] = useState('');
  const reply = task.planConfirms.at(-1);
  const mine = task.assigneeId === me.id;
  return (
    <li className="rounded-2xl border border-gray-100 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-gray-500">{task.id}</span>
        <span className="font-medium text-gray-900">{task.title}</span>
        <span className="ml-auto text-xs text-gray-500">負責人 {mention(memberMap.get(task.assigneeId)?.name)}</span>
      </div>
      {reply ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <Badge tone={reply.status === 'agree' ? 'sky' : 'red'}>{reply.status === 'agree' ? '同意延後' : '提出異議'}</Badge>
          {reply.note} · {relativeTime(reply.at)}
        </p>
      ) : mine ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="異議原因（提出異議時必填）" aria-label="異議原因" className="h-8 min-w-[200px] flex-1 rounded-full text-xs" />
          <Button size="sm" variant="primary" loading={confirmPlan.isPending} onClick={() => confirmPlan.mutate({ id: task.id, status: 'agree', note: '' })}>
            同意
          </Button>
          <Button size="sm" loading={confirmPlan.isPending} onClick={() => confirmPlan.mutate({ id: task.id, status: 'object', note }, { onSuccess: () => setNote('') })}>
            提出異議
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">等待負責人回覆</p>
      )}
    </li>
  );
}

/** G1：Sprint 規劃會議結束後，一頁看到 Project Goal、Sprint Goal、每項任務的目標範圍責任交付與確認狀態 */
export function BriefPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const sprintId = Number(id);
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: sprints } = useSprints();
  const memberMap = useMemberMap();
  const { updateProject } = useOnboardingMutations();
  const negotiate = useDisclosure();
  const [negotiating, setNegotiating] = useState<Task | null>(null);
  const [editing, setEditing] = useState(false);
  const goal = ctx.project?.goal ?? '';
  const [draft, setDraft] = useState(goal);
  useEffect(() => setDraft(goal), [goal]);

  const sprint = sprints?.find((s) => s.id === sprintId);
  const tasks = useMemo(() => ctx.allTasks.filter((t) => t.sprintId === sprintId), [ctx.allTasks, sprintId]);

  if (!me || !sprints || ctx.isLoading) return <PageSkeleton />;
  if (!sprint)
    return (
      <>
        <PageHeader eyebrow="Sprint 總覽" title="找不到這個 Sprint" />
        <Card>
          <EmptyState icon={ClipboardList} title="沒有這個 Sprint" />
          <div className="flex justify-center">
            <Button onClick={() => navigate('/sprints')}>回到 Sprint 列表</Button>
          </div>
        </Card>
      </>
    );

  const visible = tasks.filter((t) => !HIDDEN.includes(t.state));
  const deferred = tasks.filter((t) => t.state === 'DEFERRED');
  const confirmed = visible.filter((t) => CONFIRMED.includes(t.state)).length;
  const lead = isLead(me);

  return (
    <>
      <PageHeader
        eyebrow={`${sprint.name} · ${sprint.start} – ${sprint.end}`}
        title="Sprint 總覽"
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/board')}>
              前往 Active Board
            </Button>
            <Button size="sm" onClick={() => navigate('/sprints')}>
              Sprint 列表
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardHeader
            title="Project Goal"
            description="專案整體目標"
            className="mb-3"
            action={
              lead &&
              !editing && (
                <Button size="xs" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  編輯
                </Button>
              )
            }
          />
          {editing ? (
            <div className="space-y-2">
              <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Project Goal" />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setEditing(false)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!draft.trim()}
                  loading={updateProject.isPending}
                  onClick={() => updateProject.mutate({ goal: draft.trim() }, { onSuccess: () => setEditing(false) })}
                >
                  儲存
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-gray-800">{goal || '尚未設定'}</p>
          )}
        </Card>
        <Card className="p-5">
          <CardHeader title="Sprint Goal" description={`${sprint.name} 預期完成的目標`} className="mb-3" />
          <p className="text-sm leading-relaxed text-gray-800">{sprint.goal || '尚未設定'}</p>
        </Card>
      </div>

      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-900">成員確認進度</span>
          <span className="tabular-nums text-gray-600">
            {confirmed}/{visible.length} 已確認
          </span>
        </div>
        <ProgressBar value={confirmed} max={Math.max(visible.length, 1)} tone="sky" size="md" label="成員確認進度" />
        <p className="mt-2 text-xs text-gray-500">每位負責人都要理解並接受任務；對範圍、驗收條件、工時或負責人有疑問時，可以直接協商。</p>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="還沒有核准的任務"
            description={sprint.status === 'planning' ? 'Leader 在 Sprint 規劃核准並發送指派邀請後，任務會顯示在這裡。' : '這個 Sprint 沒有任務。'}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((t) => (
            <BriefTask
              key={t.id}
              task={t}
              me={me}
              memberMap={memberMap}
              onNegotiate={(task) => {
                setNegotiating(task);
                negotiate.open();
              }}
            />
          ))}
        </div>
      )}

      {deferred.length > 0 && (
        <section className="mt-8" aria-label="已延後的任務">
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-gray-900">已延後（{deferred.length}）</h2>
          <Callout className="mb-3">延後的任務會記錄到延續事項，下次建立 Sprint 時自動帶入。負責人可以同意或提出異議。</Callout>
          <ul className="space-y-2">
            {deferred.map((t) => (
              <DeferredRow key={t.id} task={t} me={me} memberMap={memberMap} />
            ))}
          </ul>
        </section>
      )}

      <NegotiateDialog task={negotiating} open={negotiate.isOpen} onClose={negotiate.close} />
    </>
  );
}
