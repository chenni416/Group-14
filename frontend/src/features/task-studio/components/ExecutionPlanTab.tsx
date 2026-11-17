import { ArrowDown, ArrowUp, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, IconButton, Input, ProgressBar, Select } from '@/components/ui';
import { useExecutionActions } from '@/hooks/useCollab';
import { cn } from '@/lib/cn';
import { checklistProgress, demoToday, formatDay, isBehind, nextChecklistItem, nextCheckpoint, planOverrun } from '@/lib/execution';
import type { ExecutionPlan, Member, SaveExecutionPlanInput, Sprint, Task } from '@/types';

const PLAN_STATES = ['ASSIGNED', 'TODO', 'IN_PROGRESS'];
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const time = (d: string) => Date.parse(`${d}T00:00:00Z`);

interface Props {
  task: Task;
  me: Member;
  sprint: Sprint | undefined;
  plan: ExecutionPlan | undefined;
}

/** 水平時間軸：Checklist 預計日期與 Checkpoint 落在 Sprint 期間的位置，超過結束日標示為橘色 */
function Timeline({ plan, sprint, today }: { plan: ExecutionPlan; sprint: Sprint | undefined; today: string }) {
  const dates = [...plan.checklist.map((c) => c.dueAt), ...plan.checkpoints.map((c) => c.dueAt)].filter((d): d is string => !!d);
  const start = sprint?.startDate ?? [...dates].sort()[0] ?? today;
  const end = sprint?.endDate ?? [...dates].sort().at(-1) ?? today;
  const span = Math.max(time(end) - time(start), 1);
  const pct = (d: string) => Math.max(0, Math.min(100, ((time(d) - time(start)) / span) * 100));
  const over = (d: string | null) => d != null && d > end;

  return (
    <div className="px-3 pb-10 pt-6" aria-label="執行時間軸">
      <div className="relative h-2 rounded-full bg-gray-100">
        <span className="absolute -top-5 left-0 text-[11px] tabular-nums text-gray-500">{formatDay(start)}</span>
        <span className="absolute -top-5 right-0 text-[11px] tabular-nums text-gray-500">{formatDay(end)} 結束</span>
        <span className="absolute -top-1 bottom-[-4px] w-px bg-gray-400" style={{ left: `${pct(today)}%` }} title={`今天 ${formatDay(today)}`} />
        {plan.checklist.map((c) =>
          c.dueAt ? (
            <span
              key={c.id}
              title={`${c.text}（${formatDay(c.dueAt)}）`}
              className={cn(
                'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white',
                c.done ? 'bg-sky-500' : over(c.dueAt) ? 'bg-orange-500' : 'bg-gray-400',
              )}
              style={{ left: `${pct(c.dueAt)}%` }}
            />
          ) : null,
        )}
        {plan.checkpoints.map((c, i) => (
          <span key={c.id} className="absolute top-1/2" style={{ left: `${pct(c.dueAt)}%` }}>
            <span
              className={cn(
                'absolute left-0 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white',
                c.reachedAt ? 'bg-sky-600' : over(c.dueAt) ? 'bg-orange-600' : 'bg-neutral-900',
              )}
            />
            <span
              className={cn(
                'absolute -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-600',
                i % 2 === 0 ? 'top-3' : 'top-8',
              )}
            >
              {c.title} · {formatDay(c.dueAt)}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" />Checklist 預計日</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />已完成</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 bg-neutral-900" />Checkpoint</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />超出 Sprint 結束日</span>
      </div>
    </div>
  );
}

/** G3：成員接受任務後的 Execution Planning（Checklist、Timeline、Checkpoints、Dependencies Check） */
export function ExecutionPlanTab({ task, me, sprint, plan }: Props) {
  const { suggest, save, confirm, toggleItem, toggleCheckpoint } = useExecutionActions();
  const owner = task.assigneeId === me.id;
  const canPlan = PLAN_STATES.includes(task.state);
  const editable = owner && canPlan;

  if (!plan) {
    if (!canPlan) {
      return (
        <Card>
          <EmptyState
            icon={Sparkles}
            title={task.state === 'DONE' || task.state === 'IN_REVIEW' ? '這項任務沒有執行計畫' : '接受任務後才能建立執行計畫'}
            description="成員接受任務、Sprint 啟動後，這裡會協助規劃 Checklist、時程與檢查節點。"
          />
        </Card>
      );
    }
    if (!owner) {
      return (
        <Card>
          <EmptyState icon={Sparkles} title="負責人還沒有建立執行計畫" description="只有負責人可以建立與調整，其他人可以在建立後查看進度。" />
        </Card>
      );
    }
    return (
      <Card className="space-y-4">
        <CardHeader title="還不知道從哪裡開始？" description="讓 AI 依已確認的任務規格、前置任務與專案文件，產生可以直接調整的執行計畫。" className="mb-0" />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={suggest.isPending} onClick={() => suggest.mutate(task.id)}>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            讓 AI 建議
          </Button>
          <Button
            loading={save.isPending}
            onClick={() =>
              save.mutate({
                taskId: task.id,
                input: { checklist: [{ id: newId('ck'), text: '閱讀任務規格與驗收條件', done: false, acIndex: null, dueAt: null }], checkpoints: [], depChecks: [] },
              })
            }
          >
            自己建立
          </Button>
        </div>
        <Callout>AI 只提供建議，你可以隨時編輯、刪除或新增項目，確認後才會開始顯示在看板上。</Callout>
      </Card>
    );
  }

  const today = demoToday(sprint);
  const progress = checklistProgress(plan);
  const next = nextChecklistItem(plan);
  const nextCp = nextCheckpoint(plan);
  const behind = isBehind(plan, today);
  const overrun = sprint ? planOverrun(plan, sprint.endDate) : false;

  const commit = (patch: Partial<SaveExecutionPlanInput>) =>
    save.mutate({ taskId: task.id, input: { checklist: plan.checklist, checkpoints: plan.checkpoints, depChecks: plan.depChecks, ...patch } });
  const move = (i: number, dir: -1 | 1) => {
    const list = [...plan.checklist];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    commit({ checklist: list });
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">執行計畫</h3>
              {plan.origin === 'ai' && !plan.edited && (
                <Badge tone="violet">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  AI 建議
                </Badge>
              )}
              {plan.origin === 'ai' && plan.edited && <Badge tone="neutral">已調整 AI 建議</Badge>}
              {plan.confirmedAt ? <Badge tone="sky" dot>已確認</Badge> : <Badge tone="orange" dot>尚未確認</Badge>}
              {behind && <Badge tone="red" dot>進度落後</Badge>}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {progress.done}/{progress.total} 項完成
            </p>
          </div>
          {editable && !plan.confirmedAt && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={suggest.isPending}
                onClick={() => {
                  if (!plan.edited || window.confirm('重新產生會覆蓋你已調整的內容，確定嗎？')) suggest.mutate(task.id);
                }}
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                重新讓 AI 建議
              </Button>
              <Button size="sm" variant="primary" loading={confirm.isPending} onClick={() => confirm.mutate(task.id)}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                確認計畫
              </Button>
            </div>
          )}
        </div>
        <ProgressBar value={progress.done} max={Math.max(progress.total, 1)} tone="sky" size="md" label="Checklist 完成度" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">下一步</div>
            <div className="mt-0.5 text-sm font-medium text-gray-900">{next ? next.text : '所有項目都完成了'}</div>
            {next?.dueAt && <div className="mt-0.5 text-xs tabular-nums text-gray-500">預計 {formatDay(next.dueAt)}</div>}
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <div className="text-xs text-gray-500">下一個 Checkpoint</div>
            <div className="mt-0.5 text-sm font-medium text-gray-900">{nextCp ? nextCp.title : '沒有待達成的 Checkpoint'}</div>
            {nextCp && <div className="mt-0.5 text-xs tabular-nums text-gray-500">預計 {formatDay(nextCp.dueAt)}</div>}
          </div>
        </div>
        {overrun && <Callout tone="warning">有項目的預計日期超過 Sprint 結束日，請調整時程，或回報時程問題。</Callout>}
        {!owner && <Callout>只有負責人可以調整計畫，你可以查看進度。</Callout>}
      </Card>

      <Card className="p-5">
        <CardHeader title="Checklist" description="具體執行步驟；可對應某一條驗收條件" className="mb-3" />
        <ul className="space-y-2">
          {plan.checklist.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 p-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={c.done}
                aria-label={`完成：${c.text}`}
                disabled={!editable}
                onClick={() => toggleItem.mutate({ taskId: task.id, itemId: c.id })}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed',
                  c.done ? 'border-sky-500 bg-sky-500 text-white' : 'border-gray-300 bg-white text-transparent hover:border-gray-500',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
              <Input
                key={`${c.id}-${c.text}`}
                defaultValue={c.text}
                disabled={!editable}
                aria-label="Checklist 項目"
                className={cn('min-w-[180px] flex-1', c.done && 'text-gray-400 line-through')}
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.text && commit({ checklist: plan.checklist.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })}
              />
              <Select
                value={c.acIndex == null ? '' : String(c.acIndex)}
                disabled={!editable}
                aria-label="對應的驗收條件"
                className="w-32"
                onChange={(e) => commit({ checklist: plan.checklist.map((x) => (x.id === c.id ? { ...x, acIndex: e.target.value === '' ? null : Number(e.target.value) } : x)) })}
              >
                <option value="">不對應 AC</option>
                {task.acceptanceCriteria.map((_, k) => (
                  <option key={k} value={k}>
                    對應 AC {k + 1}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                value={c.dueAt ?? ''}
                disabled={!editable}
                aria-label="預計完成日"
                className={cn('w-36', sprint && c.dueAt && c.dueAt > sprint.endDate && 'border-orange-300')}
                onChange={(e) => commit({ checklist: plan.checklist.map((x) => (x.id === c.id ? { ...x, dueAt: e.target.value || null } : x)) })}
              />
              {editable && (
                <div className="flex shrink-0 gap-1">
                  <IconButton size="sm" variant="ghost" aria-label="上移" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                  <IconButton size="sm" variant="ghost" aria-label="下移" disabled={i === plan.checklist.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                  <IconButton size="sm" variant="ghost" aria-label="刪除" onClick={() => commit({ checklist: plan.checklist.filter((x) => x.id !== c.id) })}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <Button size="sm" className="mt-3" onClick={() => commit({ checklist: [...plan.checklist, { id: newId('ck'), text: '新的步驟', done: false, acIndex: null, dueAt: null }] })}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            新增項目
          </Button>
        )}
      </Card>

      <Card className="p-5">
        <CardHeader title="Timeline" description={sprint ? `${sprint.name} · ${formatDay(sprint.startDate)} – ${formatDay(sprint.endDate)}` : '預計執行順序與完成時間'} className="mb-1" />
        <Timeline plan={plan} sprint={sprint} today={today} />
      </Card>

      <Card className="p-5">
        <CardHeader title="Checkpoints" description="階段性檢查節點，達成後會更新看板上的進度" className="mb-3" />
        <ul className="space-y-2">
          {plan.checkpoints.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 p-2">
              <Input
                key={`${c.id}-${c.title}`}
                defaultValue={c.title}
                disabled={!editable}
                aria-label="Checkpoint 名稱"
                className="min-w-[160px] flex-1"
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && commit({ checkpoints: plan.checkpoints.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)) })}
              />
              <Input
                type="date"
                value={c.dueAt}
                disabled={!editable}
                aria-label="Checkpoint 預計日"
                className="w-36"
                onChange={(e) => e.target.value && commit({ checkpoints: plan.checkpoints.map((x) => (x.id === c.id ? { ...x, dueAt: e.target.value } : x)) })}
              />
              <Button size="sm" variant={c.reachedAt ? 'primary' : 'secondary'} disabled={!editable} onClick={() => toggleCheckpoint.mutate({ taskId: task.id, checkpointId: c.id })}>
                {c.reachedAt ? '已達成' : '標示達成'}
              </Button>
              {editable && (
                <IconButton size="sm" variant="ghost" aria-label="刪除 Checkpoint" onClick={() => commit({ checkpoints: plan.checkpoints.filter((x) => x.id !== c.id) })}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
              )}
            </li>
          ))}
          {!plan.checkpoints.length && <li className="text-sm text-gray-400">還沒有 Checkpoint</li>}
        </ul>
        {editable && (
          <Button size="sm" className="mt-3" onClick={() => commit({ checkpoints: [...plan.checkpoints, { id: newId('cp'), title: '新的檢查節點', dueAt: sprint?.endDate ?? today, reachedAt: null }] })}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            新增 Checkpoint
          </Button>
        )}
      </Card>

      <Card className="p-5">
        <CardHeader title="Dependencies Check" description="執行所需的前置條件與資訊；來源是前置任務與知識庫文件" className="mb-3" />
        <ul className="space-y-2">
          {plan.depChecks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100 p-2">
              <Badge tone={c.met ? 'sky' : 'orange'} dot>
                {c.met ? '已滿足' : '未滿足'}
              </Badge>
              <Input
                key={`${c.id}-${c.text}`}
                defaultValue={c.text}
                disabled={!editable}
                aria-label="前置條件"
                className="min-w-[160px] flex-1"
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.text && commit({ depChecks: plan.depChecks.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })}
              />
              <span className="shrink-0 text-xs text-gray-500">{c.source}</span>
              {editable && (
                <>
                  <Button size="sm" onClick={() => commit({ depChecks: plan.depChecks.map((x) => (x.id === c.id ? { ...x, met: !x.met } : x)) })}>
                    {c.met ? '改為未滿足' : '標示已滿足'}
                  </Button>
                  <IconButton size="sm" variant="ghost" aria-label="刪除前置條件" onClick={() => commit({ depChecks: plan.depChecks.filter((x) => x.id !== c.id) })}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </IconButton>
                </>
              )}
            </li>
          ))}
          {!plan.depChecks.length && <li className="text-sm text-gray-400">沒有需要確認的前置條件</li>}
        </ul>
        {editable && (
          <Button size="sm" className="mt-3" onClick={() => commit({ depChecks: [...plan.depChecks, { id: newId('dc'), text: '新的前置條件', met: false, source: '手動' }] })}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            新增前置條件
          </Button>
        )}
      </Card>
    </div>
  );
}
