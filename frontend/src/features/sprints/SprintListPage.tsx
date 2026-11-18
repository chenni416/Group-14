import { CalendarClock, Layers, Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, CardHeader, Modal, PageHeader, PageSkeleton, ProgressBar } from '@/components/ui';
import { useBacklog, useCurrentUser, useMemberMap, useMembers, useSprintContext, useSprints } from '@/hooks/queries';
import type { Tone } from '@/lib/constants';
import { sum } from '@/lib/format';
import { isLead as isLeadRole } from '@/lib/permissions';
import { capTotal, isUnfinished, PLANNING_STEPS } from '@/lib/planning';
import type { BacklogDecision, Sprint, SprintStatus, Task } from '@/types';
import { useSprintMutations } from './hooks/useSprintMutations';

const BACKLOG_DECISION_LABEL: Record<BacklogDecision, string> = { include: '納入本輪', keep: '繼續保留', remove: '將移除' };

const STATUS: Record<SprintStatus, { label: string; tone: Tone }> = {
  planning: { label: '規劃中', tone: 'orange' },
  active: { label: '進行中', tone: 'sky' },
  closed: { label: '已結束', tone: 'neutral' },
};

function stats(sprint: Sprint, tasks: Task[]) {
  if (sprint.status === 'closed' && sprint.summary) return sprint.summary;
  const list = tasks.filter((t) => t.sprintId === sprint.id && t.state !== 'DEFERRED');
  return {
    total: sum(list.map((t) => t.storyPoints)),
    done: sum(list.filter((t) => t.state === 'DONE').map((t) => t.storyPoints)),
    tasks: list.length,
  };
}

/** Sprint 建立與 AI 拆解的入口：列出所有 Sprint、建立 Sprint、延續事項 */
export function SprintListPage() {
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const { data: sprints } = useSprints();
  const { data: members = [] } = useMembers();
  const { data: backlog = [] } = useBacklog();
  const memberMap = useMemberMap();
  const ctx = useSprintContext();
  const { removeBacklog } = useSprintMutations();
  const [review, setReview] = useState<Sprint | null>(null);

  if (!sprints || !me || ctx.isLoading) return <PageSkeleton />;

  const lead = isLeadRole(me);
  const hasPlanning = sprints.some((s) => s.status === 'planning');
  const unfinished = ctx.boardTasks.filter(isUnfinished);
  const pendingBacklog = backlog.filter((b) => b.usedInSprintId == null);
  const multi = ctx.allTasks.filter((t) => t.multiSprint && t.state !== 'DONE' && t.state !== 'DEFERRED');

  return (
    <>
      <PageHeader
        eyebrow="Sprint 建立與管理"
        title="Sprint 列表"
        actions={
          lead && (
            <Button
              variant="primary"
              disabled={hasPlanning}
              title={hasPlanning ? '已有規劃中的 Sprint，請先完成或啟動它' : undefined}
              onClick={() => navigate('/sprints/planning')}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              建立 Sprint
            </Button>
          )
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {[...sprints]
            .sort((a, b) => b.id - a.id)
            .map((s) => {
              const st = stats(s, ctx.allTasks);
              const planTasks = ctx.allTasks.filter((t) => t.sprintId === s.id && t.state !== 'DEFERRED');
              const unanswered = (s.questions ?? []).filter((q) => !q.answer).length;
              const step = s.step === 5 && planTasks.some((t) => t.state === 'AI_DRAFT' || t.state === 'DRAFT') ? 4 : s.step;
              return (
                <Card key={s.id} className={s.status === 'planning' ? 'border-orange-200' : undefined}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight">{s.name}</h2>
                        <Badge tone={STATUS[s.status].tone} dot>
                          {STATUS[s.status].label}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {s.start} – {s.end}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-700">{s.goal || <span className="text-gray-400">Sprint Goal 尚未設定（AI 會從會議紀錄擷取）</span>}</p>
                      {s.status === 'planning' ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {PLANNING_STEPS.map((label, i) => (
                              <Badge key={label} tone={i + 1 < step ? 'sky' : i + 1 === step ? 'orange' : 'neutral'}>
                                {i + 1}. {label}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span>
                              Capacity <b className="text-sm text-gray-900">{capTotal(s, members)}</b> SP
                            </span>
                            <span>
                              任務 <b className="text-sm text-gray-900">{planTasks.length}</b>
                            </span>
                            <span>
                              已規劃 <b className="text-sm text-gray-900">{sum(planTasks.map((t) => t.storyPoints))}</b> SP
                            </span>
                            {unanswered > 0 && <span className="text-violet-700">待釐清 {unanswered} 題</span>}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="mt-3 flex flex-wrap gap-x-4 text-xs text-gray-500">
                            <span>
                              任務 <b className="text-sm text-gray-900">{st.tasks}</b>
                            </span>
                            <span>
                              完成{' '}
                              <b className="text-sm text-gray-900">
                                {st.done}/{st.total}
                              </b>{' '}
                              SP
                            </span>
                            <span>
                              Capacity <b className="text-sm text-gray-900">{capTotal(s, members)}</b> SP
                            </span>
                          </p>
                          <ProgressBar value={st.done} max={st.total} tone={s.status === 'active' ? 'sky' : 'dark'} size="sm" className="mt-2" label={`${s.name} 完成度`} />
                        </>
                      )}
                    </div>
                    {s.status === 'planning' ? (
                      lead && (
                        <Button variant="primary" onClick={() => navigate('/sprints/planning')}>
                          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                          開啟 Planning Studio
                        </Button>
                      )
                    ) : s.status === 'active' ? (
                      <Button onClick={() => navigate('/board')}>開啟看板</Button>
                    ) : (
                      <Button onClick={() => setReview(s)}>查看回顧</Button>
                    )}
                  </div>
                </Card>
              );
            })}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="延續事項" description="規劃下一個 Sprint 時，在「上輪 Sprint 統整」決定未完成任務帶入或延後，以及延續事項是否納入本輪。" action={<Badge>下次規劃時處理</Badge>} />
            <ul className="divide-y divide-gray-100 text-sm">
              {unfinished.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2">
                  <Avatar member={memberMap.get(t.assigneeId)} size="xs" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs text-gray-500">{t.id}</span> {t.title}
                  </span>
                  <Badge tone={t.carry == null ? 'orange' : 'neutral'}>{t.carry == null ? '未完成' : t.carry ? '帶入' : '延後'}</Badge>
                </li>
              ))}
              {pendingBacklog.map((b) => (
                <li key={b.id} className="flex items-center gap-2 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
                    {b.kind === 'multi' ? <Layers className="h-3.5 w-3.5" strokeWidth={1.75} /> : <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{b.text}</div>
                    <div className="text-xs text-gray-500">
                      {b.kind === 'multi' ? '跨 Sprint · 自 ' : '延後 · 來自 '}
                      {b.fromSprint}
                      {b.decision && ` · ${BACKLOG_DECISION_LABEL[b.decision]}`}
                    </div>
                  </div>
                  {lead && (
                    <button type="button" aria-label={`移除 ${b.text}`} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-900" onClick={() => removeBacklog.mutate(b.id)}>
                      <X className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </li>
              ))}
              {multi.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2">
                  <Avatar member={memberMap.get(t.assigneeId)} size="xs" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-mono text-xs text-gray-500">{t.id}</span> {t.title}
                  </span>
                  <Badge tone="violet">跨 Sprint</Badge>
                </li>
              ))}
              {!unfinished.length && !pendingBacklog.length && !multi.length && <li className="py-2 text-gray-400">目前沒有延續事項</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="流程" />
            <ol className="space-y-2 text-sm">
              {[
                '1 上輪 Sprint 統整：檢視完成狀況，決定未完成任務帶入或延後（可改派），處理延續事項',
                '2 開啟 Sprint 與設定：名稱、日期、Capacity、會議紀錄與文件，按下 AI 分析才建立 Sprint',
                '3 Story 分析確認：AI 切分 Story，Leader 確認範疇與點數',
                '4 Task 拆解與派工：拆解 Task 並指派負責人與審查方式',
                '5 派工總覽與發送：確認容量後發送指派邀請與帶入／延後確認',
              ].map((x) => (
                <li key={x} className="rounded-2xl bg-gray-50 px-3 py-2">
                  {x}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <Modal open={!!review} onClose={() => setReview(null)} title={`${review?.name ?? ''} 回顧`}>
        {review && (
          <div className="space-y-3 text-sm">
            <p className="rounded-2xl bg-gray-50 px-4 py-3">
              <span className="block text-xs text-gray-500">SPRINT GOAL</span>
              {review.goal || '—'}
            </p>
            {(() => {
              const st = stats(review, ctx.allTasks);
              return (
                <>
                  <p className="flex justify-between text-gray-600">
                    <span>
                      {review.start} – {review.end} · {st.tasks} 項任務
                    </span>
                    <b className="text-gray-900">
                      {st.done}/{st.total} SP（{st.total ? Math.round((st.done / st.total) * 100) : 0}%）
                    </b>
                  </p>
                  <ProgressBar value={st.done} max={st.total} size="md" label="完成度" />
                </>
              );
            })()}
          </div>
        )}
      </Modal>
    </>
  );
}
