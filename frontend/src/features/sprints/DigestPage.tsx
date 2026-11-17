import { Check, Plus, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Callout, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, ProgressBar } from '@/components/ui';
import { useBacklog, useCurrentUser, useDependencies, useMemberMap, useSprintContext, useSprints } from '@/hooks/queries';
import { useIssues, useProposals, useRetros } from '@/hooks/useCollab';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { ISSUE_STATUS, ISSUE_TYPES, PROPOSAL_KINDS, PROPOSAL_STATUS, isOpenIssue } from '@/lib/collab';
import { TASK_STATES } from '@/lib/constants';
import { mention } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import { isUnfinished } from '@/lib/planning';
import { sum } from '@/lib/format';
import type { Task } from '@/types';

function Block({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <CardHeader title={title} className="mb-3" action={count != null && <Badge className="tabular-nums">{count}</Badge>} />
      {children}
    </Card>
  );
}

const Empty = ({ text }: { text: string }) => <p className="text-sm text-gray-400">{text}</p>;

/** G6：下一次 Sprint Planning 開始前，統整上一個 Sprint 的成果、未完成、未解決問題、提案與延後事項 */
export function DigestPage() {
  const navigate = useNavigate();
  const drawer = useTaskDrawer();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: sprints } = useSprints();
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const { data: backlog = [] } = useBacklog();
  const { data: retros = [] } = useRetros();
  const memberMap = useMemberMap();

  // 上一個 Sprint：最近一個進行中或已結束的 Sprint
  const previous = useMemo(() => [...(sprints ?? [])].filter((s) => s.status !== 'planning').sort((a, b) => b.id - a.id)[0], [sprints]);
  const { data: dependencies = [] } = useDependencies(ctx.planning?.id);

  if (!me || !sprints || ctx.isLoading) return <PageSkeleton />;

  if (!previous)
    return (
      <>
        <PageHeader eyebrow="Sprint Planning 前" title="會議前統整" />
        <Card>
          <EmptyState icon={Sparkles} title="這是第一個 Sprint" description="還沒有前次 Sprint 的資料，直接建立 Sprint 開始規劃即可。" />
          <div className="flex justify-center">
            <Button variant="primary" onClick={() => navigate('/sprints?create=1')}>
              建立 Sprint
            </Button>
          </div>
        </Card>
      </>
    );

  const tasks = ctx.allTasks.filter((t) => t.sprintId === previous.id && t.state !== 'DEFERRED');
  const done = tasks.filter((t) => t.state === 'DONE');
  const total = sum(tasks.map((t) => t.storyPoints));
  const doneSp = sum(done.map((t) => t.storyPoints));
  const unfinished = tasks.filter(isUnfinished);
  const openIssues = issues.filter(isOpenIssue);
  const openProposals = proposals.filter((p) => p.status === 'open' || p.status === 'nextSprint');
  const deferredBacklog = backlog.filter((b) => b.usedInSprintId == null);
  const deferredTasks = ctx.allTasks.filter((t) => t.state === 'DEFERRED' && t.sprintId === previous.id);
  const retro = retros.find((r) => r.sprintId === previous.id);
  const actions = retro?.actions ?? [];
  const taskLink = (t: Task) => (
    <button type="button" onClick={() => drawer.open(t.id, 'delivery')} className="min-w-0 truncate text-left underline-offset-2 hover:underline">
      <span className="mr-1.5 font-mono text-xs text-gray-500">{t.id}</span>
      {t.title}
    </button>
  );
  const pct = total ? Math.round((doneSp / total) * 100) : 0;
  const lead = isLead(me);

  return (
    <>
      <PageHeader
        eyebrow={`${previous.name} 的結果 → 下一次 Sprint Planning`}
        title="會議前統整"
        actions={
          <Button variant="primary" disabled={!lead || !!ctx.planning} title={!lead ? '只有 Leader / PO 可以建立 Sprint' : ctx.planning ? '已有規劃中的 Sprint' : undefined} onClick={() => navigate('/sprints?create=1')}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            建立下一個 Sprint
          </Button>
        }
      />
      <Callout className="mb-6">
        會議開始前先看一遍這些內容：勾選的事項會寫進下一次會議紀錄的「延續事項」。
        {previous.status === 'active' && '（這個 Sprint 還沒有結束，結果會隨進度更新。）'}
      </Callout>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Block title="Delivered Outcomes · 實際交付成果" count={done.length}>
          {done.length ? (
            <ul className="space-y-2 text-sm">
              {done.map((t) => (
                <li key={t.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" strokeWidth={2.4} />
                    {taskLink(t)}
                  </div>
                  {(t.pr || t.delivery) && (
                    <p className="mt-1 pl-6 text-xs text-gray-500">
                      {t.pr ? `PR #${t.pr.number} ${t.pr.status}` : ''}
                      {t.delivery?.deliverables.length ? ` · 交付 ${t.delivery.deliverables.filter((d) => d.provided).length}/${t.delivery.deliverables.length} 項` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="還沒有完成的任務" />
          )}
        </Block>

        <Block title="Task Progress · 任務進度">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-gray-500">{previous.name}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{pct}%</span> · {doneSp}/{total} SP
            </span>
          </div>
          <ProgressBar value={doneSp} max={Math.max(total, 1)} tone="sky" size="md" label="上一個 Sprint 完成度" />
          <p className="mt-2 text-xs text-gray-500">
            {tasks.length} 項任務：完成 {done.length}、未完成 {unfinished.length}
          </p>
        </Block>

        <Block title="Unfinished Tasks · 未完成的任務" count={unfinished.length}>
          {unfinished.length ? (
            <ul className="space-y-2 text-sm">
              {unfinished.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <Avatar member={memberMap.get(t.assigneeId)} size="xs" />
                  {taskLink(t)}
                  <Badge className="ml-auto">{TASK_STATES[t.state].label}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="全部完成" />
          )}
          <p className="mt-2 text-xs text-gray-500">啟動下一個 Sprint 時，由 Leader 選擇帶入或延後。</p>
        </Block>

        <Block title="Unresolved Issues · 未解決的問題" count={openIssues.length}>
          {openIssues.length ? (
            <ul className="space-y-2 text-sm">
              {openIssues.map((i) => (
                <li key={i.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{i.taskId}</span>
                    <Badge>{ISSUE_TYPES[i.type].label}</Badge>
                    <Badge tone={ISSUE_STATUS[i.status].tone} dot>
                      {ISSUE_STATUS[i.status].label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-gray-700">{i.description}</p>
                  <p className="mt-0.5 text-xs text-gray-500">處理人：{i.ownerId ? mention(memberMap.get(i.ownerId)?.name) : '尚未指派'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="沒有未解決的問題" />
          )}
        </Block>

        <Block title="Ideas & Proposals · 想法與提案" count={openProposals.length}>
          {openProposals.length ? (
            <ul className="space-y-2 text-sm">
              {openProposals.map((p) => (
                <li key={p.id} className="rounded-xl bg-gray-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{PROPOSAL_KINDS[p.kind]}</Badge>
                    <Badge tone={PROPOSAL_STATUS[p.status].tone} dot>
                      {PROPOSAL_STATUS[p.status].label}
                    </Badge>
                  </div>
                  <p className="mt-1 font-medium text-gray-900">{p.title}</p>
                  {p.decision && <p className="mt-0.5 text-xs text-gray-500">決策：{p.decision}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="沒有待處理的提案" />
          )}
          <p className="mt-2 text-xs text-gray-500">待決策的提案，建議在會議中討論並決定是否納入。</p>
        </Block>

        <Block title="Deferred Items · 延後的事項" count={deferredBacklog.length + deferredTasks.length}>
          {deferredBacklog.length ? (
            <ul className="space-y-2 text-sm">
              {deferredBacklog.map((b) => (
                <li key={b.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <Badge tone={b.kind === 'multi' ? 'violet' : 'orange'}>{b.kind === 'multi' ? '跨 Sprint' : '延後'}</Badge>
                  <span className="min-w-0 flex-1">{b.text}</span>
                  <span className="shrink-0 text-xs text-gray-500">{b.fromSprint}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="沒有延後的事項" />
          )}
          <p className="mt-2 text-xs text-gray-500">建立下一個 Sprint 時，這些項目會自動寫進會議紀錄。</p>
        </Block>
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Block title="上次回顧的改善行動" count={actions.length}>
          {actions.length ? (
            <ul className="space-y-2 text-sm">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                  <Badge tone={a.done ? 'sky' : 'orange'} dot>
                    {a.done ? '已完成' : '未完成'}
                  </Badge>
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <span className="shrink-0 text-xs text-gray-500">{mention(memberMap.get(a.ownerId)?.name)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text={retro ? '上次回顧沒有改善行動' : `${previous.name} 還沒有回顧`} />
          )}
          {!retro && lead && (
            <Button size="sm" className="mt-3" onClick={() => navigate(`/sprints/${previous.id}/retro`)}>
              前往回顧
            </Button>
          )}
        </Block>

        <Block title="AI 相依性分析">
          {ctx.planning ? (
            dependencies.filter((d) => d.scope === 'prev').length ? (
              <ul className="space-y-2 text-sm">
                {dependencies
                  .filter((d) => d.scope === 'prev')
                  .map((d) => (
                    <li key={`${d.taskId}-${d.dependsOnId}`} className="rounded-xl bg-gray-50 px-3 py-2">
                      <span className="font-mono text-xs text-gray-500">{d.taskId}</span> 依賴 <span className="font-mono text-xs text-gray-500">{d.dependsOnId}</span>
                      <p className="mt-0.5 text-xs text-gray-600">{d.reason}</p>
                    </li>
                  ))}
              </ul>
            ) : (
              <Empty text="目前沒有本次任務依賴上一個 Sprint 的成果" />
            )
          ) : (
            <Empty text="建立下一個 Sprint 並完成 AI 拆解後，會分析本次任務與前次成果的相依性。" />
          )}
        </Block>
      </div>
    </>
  );
}
