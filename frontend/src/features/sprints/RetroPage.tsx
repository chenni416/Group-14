import { Check, Flag, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, PageHeader, PageSkeleton, ProgressBar, Select, Textarea } from '@/components/ui';
import { EndSprintDialog } from '@/features/board/components/EndSprintDialog';
import { useCurrentUser, useMemberMap, useMembers, useSprintContext, useSprints } from '@/hooks/queries';
import { useIssues, useProposals, useRetro, useRetroActions } from '@/hooks/useCollab';
import { useDisclosure } from '@/hooks/useDisclosure';
import { ISSUE_TYPES, PROPOSAL_STATUS, isOpenIssue } from '@/lib/collab';
import { TASK_STATES } from '@/lib/constants';
import { mention, sum } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import { isUnfinished } from '@/lib/planning';

function StepTitle({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">{n}</span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
    </div>
  );
}

/** G7：Sprint 結束與 Retrospective（確認結果 → 回顧 → 改善行動），改善行動會顯示在下一次規劃前的統整 */
export function RetroPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const { data: sprints } = useSprints();
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const memberMap = useMemberMap();
  const end = useDisclosure();
  const { submitEntry, addAction, toggleAction, close } = useRetroActions();

  // /retro 沒有指定 Sprint：優先最近結束的 Sprint，否則進行中的 Sprint
  const sprint = useMemo(() => {
    const list = sprints ?? [];
    if (id) return list.find((s) => s.id === Number(id));
    return [...list].filter((s) => s.status === 'closed').sort((a, b) => b.id - a.id)[0] ?? list.find((s) => s.status === 'active');
  }, [sprints, id]);
  const { data: retro } = useRetro(sprint?.id);

  const mine = retro?.entries.find((e) => e.byId === me?.id);
  const [draft, setDraft] = useState<Form | null>(null);
  // 還沒輸入過時，表單顯示已送出的內容，方便修改
  const form: Form = draft ?? (mine ? { well: mine.well, hard: mine.hard, improve: mine.improve } : { well: '', hard: '', improve: '' });
  const [text, setText] = useState('');
  const [owner, setOwner] = useState('');

  if (!me || !sprints || ctx.isLoading) return <PageSkeleton />;
  if (!sprint)
    return (
      <>
        <PageHeader eyebrow="Retrospective" title="Sprint 回顧" />
        <Card>
          <EmptyState icon={Flag} title="還沒有可以回顧的 Sprint" description="Sprint 進行並結束後，會在這裡回顧協作過程。" />
        </Card>
      </>
    );
  if (!retro) return <PageSkeleton />;

  const lead = isLead(me);
  const tasks = ctx.allTasks.filter((t) => t.sprintId === sprint.id && t.state !== 'DEFERRED');
  const total = sum(tasks.map((t) => t.storyPoints));
  const done = sum(tasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const unfinished = tasks.filter(isUnfinished);
  const openIssues = issues.filter((i) => i.sprintId === sprint.id && isOpenIssue(i));
  const openProposals = proposals.filter((p) => p.sprintId === sprint.id && p.status === 'open');
  const closed = retro.status === 'closed';
  const ended = sprint.status === 'closed';
  const showEntries = closed || !!mine;
  const submitted = retro.entries.length;

  if (!ended) {
    return (
      <>
        <PageHeader eyebrow={`${sprint.name} · ${sprint.start} – ${sprint.end}`} title="Sprint 回顧" />
        <Card>
          <EmptyState icon={Flag} title={`${sprint.name} 還在進行中`} description="Sprint 結束後才能回顧；Leader 或 PO 可以在這裡或看板結束 Sprint。" />
          <div className="flex justify-center gap-2">
            <Button onClick={() => navigate('/board')}>回到 Active Board</Button>
            <Button variant="primary" disabled={!lead} title={lead ? undefined : '只有 Leader / PO 可以結束 Sprint'} onClick={end.open}>
              結束 Sprint
            </Button>
          </div>
        </Card>
        <EndSprintDialog open={end.isOpen} onClose={end.close} sprint={sprint} tasks={ctx.allTasks} />
      </>
    );
  }

  const columns: Array<{ key: 'well' | 'hard' | 'improve'; label: string }> = [
    { key: 'well', label: '進行順利的' },
    { key: 'hard', label: '遇到的困難' },
    { key: 'improve', label: '下次想改善的' },
  ];

  return (
    <>
      <PageHeader
        eyebrow={`${sprint.name} · ${sprint.start} – ${sprint.end}`}
        title="Sprint 回顧"
        actions={
          <>
            {closed ? <Badge tone="neutral">回顧已結束</Badge> : <Badge tone="orange" dot>回顧進行中</Badge>}
            <Button size="sm" onClick={() => navigate('/sprints/digest')}>
              會議前統整
            </Button>
          </>
        }
      />

      <div className="space-y-8">
        <section aria-label="確認結果">
          <StepTitle n={1} title="確認結果" hint="先看這個 Sprint 實際完成了什麼、留下了什麼" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-gray-500">完成度</span>
                <span className="font-semibold tabular-nums">
                  {done}/{total} SP
                </span>
              </div>
              <ProgressBar value={done} max={Math.max(total, 1)} tone="sky" size="md" label="完成度" />
              <p className="mt-3 text-sm font-medium text-gray-900">未完成的任務（{unfinished.length}）</p>
              {unfinished.length ? (
                <ul className="mt-1.5 space-y-1 text-sm text-gray-700">
                  {unfinished.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500">{t.id}</span>
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      <Badge>{TASK_STATES[t.state].label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-400">全部完成</p>
              )}
              <p className="mt-2 text-xs text-gray-500">下次啟動 Sprint 時，由 Leader 選擇帶入或延後。</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-gray-900">未解決的問題（{openIssues.length}）</p>
              {openIssues.length ? (
                <ul className="mt-1.5 space-y-1 text-sm text-gray-700">
                  {openIssues.map((i) => (
                    <li key={i.id}>
                      <span className="font-mono text-xs text-gray-500">{i.taskId}</span> <Badge className="mx-1">{ISSUE_TYPES[i.type].label}</Badge>
                      {i.description}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-400">沒有未解決的問題</p>
              )}
              <p className="mt-4 text-sm font-medium text-gray-900">待決策的提案（{openProposals.length}）</p>
              {openProposals.length ? (
                <ul className="mt-1.5 space-y-1 text-sm text-gray-700">
                  {openProposals.map((p) => (
                    <li key={p.id}>
                      <Badge tone={PROPOSAL_STATUS[p.status].tone} className="mr-1.5">
                        {PROPOSAL_STATUS[p.status].label}
                      </Badge>
                      {p.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-gray-400">沒有待決策的提案</p>
              )}
            </Card>
          </div>
        </section>

        <section aria-label="回顧">
          <StepTitle n={2} title="回顧" hint="每位成員分別填寫；送出後就能看到大家的回顧，不需要當面指出問題" />
          {!closed && (
            <Card className="mb-4 space-y-4 p-5">
              <CardHeader title={mine ? '你已送出回顧（可再修改）' : '你的回顧'} className="mb-0" />
              {columns.map((c) => (
                <Field key={c.key} label={c.label} htmlFor={`retro-${c.key}`}>
                  <Textarea
                    id={`retro-${c.key}`}
                    rows={2}
                    value={form[c.key]}
                    onChange={(e) => setDraft({ ...form, [c.key]: e.target.value })}
                    placeholder={c.key === 'hard' ? '協作、溝通、估點、依賴上遇到什麼困難？' : undefined}
                  />
                </Field>
              ))}
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  loading={submitEntry.isPending}
                  onClick={() => submitEntry.mutate({ sprintId: sprint.id, input: form })}
                >
                  <Check className="h-4 w-4" strokeWidth={2} />
                  送出回顧
                </Button>
              </div>
            </Card>
          )}
          {showEntries ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {columns.map((c) => (
                <Card key={c.key} className="p-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">{c.label}</h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {retro.entries
                      .filter((e) => e[c.key])
                      .map((e) => (
                        <li key={e.id} className="rounded-xl bg-gray-50 px-3 py-2">
                          {e[c.key]}
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                            <Avatar member={memberMap.get(e.byId)} size="xs" />
                            {mention(memberMap.get(e.byId)?.name)}
                          </span>
                        </li>
                      ))}
                    {!retro.entries.some((e) => e[c.key]) && <li className="text-gray-400">沒有內容</li>}
                  </ul>
                </Card>
              ))}
            </div>
          ) : (
            <Callout>
              已有 {submitted}/{members.length} 位成員填寫。送出你的回顧後，就能看到大家的內容。
            </Callout>
          )}
        </section>

        <section aria-label="改善行動">
          <StepTitle n={3} title="改善行動" hint="把想改善的事轉成行動項目並指定負責人，下一次規劃前會再次顯示" />
          <Card className="space-y-3 p-5">
            <ul className="space-y-2">
              {retro.actions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 p-3 text-sm">
                  <Badge tone={a.done ? 'sky' : 'orange'} dot>
                    {a.done ? '已完成' : '未完成'}
                  </Badge>
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <Avatar member={memberMap.get(a.ownerId)} size="xs" />
                    {mention(memberMap.get(a.ownerId)?.name)}
                  </span>
                  {(a.ownerId === me.id || lead) && (
                    <Button size="xs" onClick={() => toggleAction.mutate({ sprintId: sprint.id, actionId: a.id })}>
                      {a.done ? <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                      {a.done ? '改為未完成' : '標示完成'}
                    </Button>
                  )}
                </li>
              ))}
              {!retro.actions.length && <li className="text-sm text-gray-400">還沒有改善行動</li>}
            </ul>
            {!closed && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="新的改善行動" aria-label="改善行動" className="min-w-[200px] flex-1" />
                <Select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="負責人" className="w-40">
                  <option value="">選擇負責人</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Button
                  disabled={!text.trim() || !owner}
                  loading={addAction.isPending}
                  onClick={() => addAction.mutate({ sprintId: sprint.id, input: { text, ownerId: owner } }, { onSuccess: () => setText('') })}
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  新增
                </Button>
              </div>
            )}
          </Card>
          {!closed && (
            <div className="mt-4 flex justify-end">
              <Button variant="primary" disabled={!lead} title={lead ? undefined : '只有 Leader / PO 可以結束回顧'} loading={close.isPending} onClick={() => close.mutate(sprint.id)}>
                結束回顧
              </Button>
            </div>
          )}
          {closed && (
            <Callout className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span>回顧已結束。下一次規劃前，改善行動與未完成的事項會顯示在「會議前統整」。</span>
              <Button size="sm" variant="primary" onClick={() => navigate('/sprints/digest')}>
                前往會議前統整
              </Button>
            </Callout>
          )}
        </section>
      </div>
    </>
  );
}

type Form = { well: string; hard: string; improve: string };
