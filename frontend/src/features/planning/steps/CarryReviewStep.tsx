import { ArrowRight, History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Input, ProgressBar, SegmentedControl, Select, StatusBadge, Tag } from '@/components/ui';
import { useBacklog, useSprintContext } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { BOARD_STATES, type BacklogDecision, type BacklogItem, type Member, type Task } from '@/types';
import { CARRY_POINTS_MAX, capOf, carryLoad, carryOwner, carrySP } from '@/lib/planning';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';

type CarryChoice = 'carry' | 'defer' | '';

const CARRY_OPTIONS: Array<{ value: CarryChoice; label: string }> = [
  { value: 'carry', label: '帶入本輪' },
  { value: 'defer', label: '延後' },
];

const BACKLOG_OPTIONS: Array<{ value: BacklogDecision | ''; label: string }> = [
  { value: 'include', label: '納入本輪' },
  { value: 'keep', label: '繼續保留' },
  { value: 'remove', label: '移除' },
];

const choiceOf = (t: Task): CarryChoice => (t.carry === true ? 'carry' : t.carry === false ? 'defer' : '');

/** 上輪統整是否已全部決定（未完成任務與延續事項） */
export function useCarryReview() {
  const ctx = useSprintContext();
  const { data: backlog = [] } = useBacklog();
  const planningId = ctx.planning?.id ?? null;
  const items = useMemo(
    () => backlog.filter((b) => b.usedInSprintId == null || b.usedInSprintId === planningId),
    [backlog, planningId],
  );
  const undecided = ctx.carryTasks.filter((t) => t.carry == null).length + items.filter((b) => b.decision == null).length;
  return { ...ctx, backlogItems: items, undecided, ready: !ctx.isLoading && undecided === 0 };
}

/**
 * 階段 1「上輪 Sprint 統整」：檢視上一輪的完成狀況，決定未完成任務帶入或延後（帶入可改派），
 * 並處理較早累積的延續事項。全部決定後才能前往「開啟 Sprint 與設定」。
 * 決定在啟動 Sprint 時才生效；送出派工後鎖定，只有成員協商退回時才能修改。
 */
export function CarryReviewStep({ members }: { members: Member[] }) {
  const { previous, planning, allTasks, carryTasks, backlogItems, undecided, ready } = useCarryReview();
  const { setStage } = usePlanningStore();
  const { setCarry, setCarryMany, decideBacklog } = usePlanningMutations();

  if (!previous) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState icon={History} title="沒有上一輪 Sprint" description="這是第一個 Sprint，沒有需要帶入或延後的內容。" />
        <Button variant="primary" className="w-full" onClick={() => setStage('setup')}>
          前往開啟 Sprint 與設定
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </Card>
    );
  }

  const prevTasks = allTasks.filter((t) => t.sprintId === previous.id && (BOARD_STATES as readonly string[]).includes(t.state));
  const done = prevTasks.filter((t) => t.state === 'DONE');
  const totalSp = sum(prevTasks.map((t) => t.storyPoints));
  const doneSp = sum(done.map((t) => t.storyPoints));
  const rate = totalSp ? Math.round((doneSp / totalSp) * 100) : 0;
  const load = carryLoad(members, carryTasks);
  const cap = (m: Member) => capOf(planning, m);
  const carried = carryTasks.filter((t) => t.carry === true);
  const deferred = carryTasks.filter((t) => t.carry === false);
  // 只在「全部帶入／全部延後」執行時鎖定，單項選擇不閃爍整頁
  const busy = setCarryMany.isPending;
  const count = (d: BacklogDecision) => backlogItems.filter((b) => b.decision === d).length;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader
            title={`${previous.name} 完成狀況`}
            description={previous.status === 'active' ? '上一輪仍在進行中，下方數字為目前進度；啟動本輪時才會結算。' : undefined}
            action={
              <span className="text-sm tabular-nums">
                完成 <b>{doneSp}</b> / {totalSp} SP · {rate}%
              </span>
            }
          />
          <ProgressBar value={doneSp} max={totalSp} tone="sky" size="sm" label={`${previous.name} 完成度`} />
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => {
              const mine = prevTasks.filter((t) => t.assigneeId === m.id);
              const mineDone = sum(mine.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
              return (
                <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2">
                  <Avatar member={m} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                  <span className="text-xs tabular-nums text-gray-500" title="完成點數 / 上輪 Capacity">
                    <b className="text-gray-900">{mineDone}</b> / {capOf(previous, m)} SP
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-medium text-gray-900">已完成 {done.length} 項</h3>
            {done.length ? (
              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {done.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-14 shrink-0 font-mono text-xs text-gray-500">{t.id}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-700">{t.title}</span>
                    <Avatar member={members.find((m) => m.id === t.assigneeId)} size="xs" />
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">{t.storyPoints} SP</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">尚無完成的任務</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="未完成任務"
            description="逐項決定帶入本輪或延後；帶入時評估本輪還需要多少點數才能完成（預設為原點數），也可以改派給其他成員。決定在啟動 Sprint 時才生效，屆時仍未完成的任務才會依決定處理。"
            action={
              carryTasks.length > 0 && (
                <>
                  <Button size="xs" disabled={busy} onClick={() => setCarryMany.mutate({ ids: carryTasks.map((t) => t.id), carry: true })}>
                    全部帶入
                  </Button>
                  <Button size="xs" disabled={busy} onClick={() => setCarryMany.mutate({ ids: carryTasks.map((t) => t.id), carry: false })}>
                    全部延後
                  </Button>
                </>
              )
            }
          />
          {carryTasks.length ? (
            <ul className="space-y-2">
              {carryTasks.map((t) => (
                <CarryRow
                  key={t.id}
                  task={t}
                  members={members}
                  load={load}
                  cap={cap}
                  disabled={busy}
                  onChoose={(c) => setCarry.mutate({ id: t.id, input: { carry: c === 'carry' } })}
                  onAssign={(id) => setCarry.mutate({ id: t.id, input: { carry: true, assigneeId: id } })}
                  onPoints={(points) => setCarry.mutate({ id: t.id, input: { carry: true, points } })}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">上一輪的任務都已完成。</p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="延續事項"
            description="較早延後或需要跨 Sprint 的項目。「納入本輪」會寫進設定頁的會議紀錄，交給 AI 拆解；「移除」在啟動 Sprint 時刪除。"
          />
          {backlogItems.length ? (
            <ul className="space-y-2">
              {backlogItems.map((b) => (
                <BacklogRow key={b.id} item={b} disabled={busy} onChoose={(d) => decideBacklog.mutate({ id: b.id, decision: d })} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">目前沒有延續事項。</p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="工作分配"
            description={`帶入任務佔用的點數（依改派後的負責人）對照本輪 Capacity${planning ? '' : '；本輪 Capacity 可在下一步調整'}。`}
          />
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => {
              const v = load[m.id] ?? 0;
              const c = cap(m);
              const over = v > c;
              return (
                <li key={m.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar member={m} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{m.name}</span>
                    <span className={cn('text-xs font-semibold tabular-nums', over ? 'text-red-600' : 'text-gray-900')}>
                      {v}/{c} SP
                    </span>
                  </div>
                  <ProgressBar value={v} max={c || 1} tone={over ? 'red' : 'green'} size="sm" className="mt-2" label={`${m.name} 帶入負載`} />
                  <p className={cn('mt-1.5 text-xs', over ? 'text-red-600' : 'text-gray-500')}>
                    {over ? `超過本輪 Capacity ${v - c} SP，建議改派、延後或重新評估點數` : `可再分配 ${c - v} SP 給新任務`}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-0">
        <CardHeader title="統整摘要" description={`${previous.name} → ${planning?.name ?? '下一個 Sprint'}`} />
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">上輪完成</dt>
            <dd className="tabular-nums">
              {doneSp}/{totalSp} SP
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">帶入本輪</dt>
            <dd className="tabular-nums">
              {carried.length} 項 · {sum(carried.map(carrySP))} SP
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">延後</dt>
            <dd className="tabular-nums">{deferred.length} 項</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">延續事項</dt>
            <dd className="tabular-nums">
              納入 {count('include')} · 保留 {count('keep')} · 移除 {count('remove')}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <Button variant="primary" size="lg" className="w-full" disabled={!ready} onClick={() => setStage('setup')}>
            下一步：開啟 Sprint 與設定
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <p className={cn('mt-3 text-xs', ready ? 'text-gray-500' : 'text-orange-700')}>
            {ready ? '全部項目都已決定，啟動 Sprint 時才會套用。' : `還有 ${undecided} 項尚未決定`}
          </p>
        </div>
      </Card>
    </div>
  );
}

interface CarryRowProps {
  task: Task;
  members: Member[];
  load: Record<string, number>;
  cap: (m: Member) => number;
  disabled: boolean;
  onChoose: (c: Exclude<CarryChoice, ''>) => void;
  onAssign: (memberId: string) => void;
  onPoints: (points: number) => void;
}

function CarryRow({ task, members, load, cap, disabled, onChoose, onAssign, onPoints }: CarryRowProps) {
  const choice = choiceOf(task);
  const owner = carryOwner(task);
  const original = members.find((m) => m.id === task.assigneeId);
  // 選單顯示改派到該成員後的負載（不含這張任務原本算在誰身上）
  const self = task.carry === true ? carrySP(task) : 0;
  const after = (m: Member) => (load[m.id] ?? 0) - (m.id === owner ? self : 0) + carrySP(task);

  return (
    <li className={cn('rounded-2xl border p-3', choice ? 'border-gray-100' : 'border-orange-200 bg-orange-50/30')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-mono text-xs text-gray-500">{task.id}</span>
        <span className="min-w-0 flex-1 text-sm text-gray-900">{task.title}</span>
        <StatusBadge state={task.state} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Avatar member={original} size="xs" />
          {original?.name ?? '未指派'}
        </span>
        <span className="tabular-nums">原估 {task.storyPoints} SP</span>
        {!choice && <span className="text-orange-700">尚未決定</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SegmentedControl<CarryChoice>
          size="sm"
          aria-label={`${task.id} 帶入或延後`}
          value={choice}
          onChange={(c) => c && c !== choice && onChoose(c)}
          options={CARRY_OPTIONS.map((o) => ({ ...o, disabled }))}
        />
        {choice === 'carry' && (
          <CarryPointsInput task={task} disabled={disabled} onCommit={onPoints} />
        )}
        {choice === 'carry' && (
          <Select
            aria-label={`${task.id} 本輪負責人`}
            className="h-8 w-auto min-w-0 max-w-full text-xs"
            value={owner}
            disabled={disabled}
            onChange={(e) => onAssign(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === task.assigneeId ? `${m.name}（原負責人）` : `改派 ${m.name}`} · {after(m)}/{cap(m)} SP
              </option>
            ))}
          </Select>
        )}
      </div>
    </li>
  );
}

/** 本輪預估點數：預設為原點數，Leader 依剩餘工作重新評估；離開欄位或按 Enter 時儲存 */
export function CarryPointsInput({
  task,
  disabled,
  onCommit,
}: {
  task: Task;
  disabled?: boolean;
  onCommit: (points: number) => void;
}) {
  const saved = carrySP(task);
  const [value, setValue] = useState(String(saved));
  useEffect(() => setValue(String(saved)), [saved]);

  const commit = () => {
    const n = Math.round(Number(value));
    if (!value.trim() || !Number.isFinite(n)) return setValue(String(saved));
    const points = Math.min(CARRY_POINTS_MAX, Math.max(1, n));
    setValue(String(points));
    if (points !== saved) onCommit(points);
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-500">
      本輪預估
      <Input
        type="number"
        min={1}
        max={CARRY_POINTS_MAX}
        aria-label={`${task.id} 本輪預估點數`}
        className="h-8 w-16 px-2 text-xs tabular-nums"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      SP
    </label>
  );
}

function BacklogRow({ item, disabled, onChoose }: { item: BacklogItem; disabled: boolean; onChoose: (d: BacklogDecision) => void }) {
  return (
    <li className={cn('rounded-2xl border p-3', item.decision ? 'border-gray-100' : 'border-orange-200 bg-orange-50/30')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm text-gray-900">{item.text}</span>
        <Tag>{item.kind === 'multi' ? `跨 Sprint · 自 ${item.fromSprint}` : `${item.fromSprint} 延後`}</Tag>
        {!item.decision && <Badge tone="orange">尚未決定</Badge>}
      </div>
      <SegmentedControl<BacklogDecision | ''>
        size="sm"
        className="mt-3"
        aria-label={`${item.text} 處理方式`}
        value={item.decision ?? ''}
        onChange={(d) => d && d !== item.decision && onChoose(d)}
        options={BACKLOG_OPTIONS.map((o) => ({ ...o, disabled }))}
      />
    </li>
  );
}
