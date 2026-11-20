import { Hourglass } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { capOf, carryConfirmer, carrySP } from '@/lib/planning';
import type { Member, Sprint, Task } from '@/types';
import { LANES, carryLaneOf, type LaneKey } from '../lanes';

/** 三個狀態欄的色彩層次：表頭、數字膠囊、任務卡、泳道格子底色（低飽和度，視覺份量一致） */
const LANE_STYLE: Record<LaneKey, { dot: string; header: string; count: string; card: string; cell: string }> = {
  pending: {
    dot: 'bg-orange-300',
    header: 'border-orange-200/80 bg-orange-50/70 text-orange-800',
    count: 'border-orange-200/60 bg-white text-orange-700',
    card: 'border-orange-200 bg-orange-50/25 hover:border-orange-300',
    cell: 'bg-orange-50/10',
  },
  returned: {
    dot: 'bg-rose-400',
    header: 'border-rose-200/80 bg-rose-50/70 text-rose-800',
    count: 'border-rose-200/60 bg-white text-rose-700',
    card: 'border-rose-200 bg-rose-50/30 hover:border-rose-300',
    cell: 'bg-rose-50/10',
  },
  accepted: {
    dot: 'bg-sky-400',
    header: 'border-sky-200/80 bg-sky-50/70 text-sky-800',
    count: 'border-sky-200/60 bg-white text-sky-700',
    card: 'border-sky-200 bg-sky-50/25 hover:border-sky-300',
    cell: 'bg-sky-50/10',
  },
};

/** 成員欄 + 三個狀態欄；表頭與每條泳道共用同一組欄寬 */
const GRID = 'grid grid-cols-[220px_repeat(3,minmax(0,1fr))]';

interface Props {
  sprint: Sprint;
  tasks: Task[];
  /** 上輪未完成任務的帶入／延後決定（已發送給成員確認） */
  carryTasks: Task[];
  members: Member[];
  onOpen: (taskId: string) => void;
}

function TaskSummaryCard({
  task,
  lane,
  carry,
  returnedBy,
  onOpen,
}: {
  task: Task;
  lane: LaneKey;
  /** 上輪帶入／延後的決定卡 */
  carry?: boolean;
  returnedBy?: Member;
  onOpen: () => void;
}) {
  const returned = carry ? task.carryStatus === 'returned' : task.state === 'RETURNED';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('w-full rounded-xl border p-3 text-left transition-colors duration-150', LANE_STYLE[lane].card)}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-500">{task.id}</span>
        <span className="text-[11px] font-medium tabular-nums text-gray-700">
          {carry ? (task.carry ? `本輪 ${carrySP(task)} SP` : '—') : `${task.storyPoints} SP`}
        </span>
      </span>
      <span className="mt-1 line-clamp-2 block text-sm leading-snug text-gray-900">{task.title}</span>
      {carry && (
        <span className="mt-2 inline-flex h-5 items-center rounded-full border border-gray-200 bg-white px-2 text-[11px] text-gray-600">
          {task.carry ? '上輪帶入' : '上輪延後'}
        </span>
      )}
      {!carry && task.dependsOn.length > 0 && (
        <span className="mt-2 flex flex-wrap gap-1" title={task.dependsOn.map((d) => `${d.id}：${d.reason}`).join('\n')}>
          {task.dependsOn.map((d) => (
            <span key={d.id} className="inline-flex h-5 items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 text-[10px] text-gray-600">
              <Hourglass className="h-3 w-3" strokeWidth={1.75} />
              <span className="font-mono">等 {d.id} 完成</span>
            </span>
          ))}
        </span>
      )}
      {returned && task.negotiation && (
        <span className="mt-2 block rounded-lg bg-rose-100/50 px-2.5 py-2 text-xs leading-relaxed text-rose-800">
          <span className="font-medium">{returnedBy?.name ?? '成員'}：</span>
          {task.negotiation.reason}
        </span>
      )}
    </button>
  );
}

/**
 * 已送出規劃的追蹤看板：成員為橫向泳道，貫穿「待確認／協商退回／已接受」三個狀態直欄。
 * 表頭在桌面寬度下固定於主內容區頂端；手機寬度改為橫向捲動。
 */
export function AssignmentSwimlanes({ sprint, tasks, carryTasks, members, onOpen }: Props) {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const carryIds = new Set(carryTasks.map((t) => t.id));
  const laneKey = (t: Task) => (carryIds.has(t.id) ? carryLaneOf(t) : LANES.find((l) => l.states.includes(t.state))?.key);
  const lanesOf = (list: Task[]) =>
    Object.fromEntries(LANES.map((l) => [l.key, list.filter((t) => laneKey(t) === l.key)])) as Record<LaneKey, Task[]>;
  const all = [...tasks, ...carryTasks];
  const totals = lanesOf(all);
  // 決定卡放在需要確認的成員泳道：帶入給新負責人、延後給目前負責人
  const ownerOf = (t: Task) => (carryIds.has(t.id) ? carryConfirmer(t) : t.assigneeId);
  const rows = members.filter((m) => all.some((t) => ownerOf(t) === m.id));

  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:overflow-visible">
      <div className="min-w-[880px] space-y-3">
        {/* 固定的狀態表頭 */}
        <div
          className={cn(
            GRID,
            'z-10 items-center rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_0_0_12px_#fff] lg:sticky lg:-top-8',
          )}
          role="row"
        >
          <div className="px-3 text-xs font-medium text-gray-500" role="columnheader">
            成員
          </div>
          {LANES.map((l) => {
            const count = totals[l.key].length;
            const style = LANE_STYLE[l.key];
            return (
              <div
                key={l.key}
                role="columnheader"
                className={cn('mx-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium', style.header)}
              >
                <span className={cn('h-2 w-2 rounded-full', style.dot)} aria-hidden />
                {l.label}
                <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-xs tabular-nums', style.count)}>{count} 張</span>
              </div>
            );
          })}
        </div>

        {/* 成員泳道 */}
        {rows.map((m) => {
          const mine = all.filter((t) => ownerOf(t) === m.id);
          const lanes = lanesOf(mine);
          const load = sum(mine.map((t) => (carryIds.has(t.id) ? (t.carry ? carrySP(t) : 0) : t.storyPoints)));
          const cap = capOf(sprint, m);
          const over = load > cap;
          return (
            <section key={m.id} aria-label={`${m.name} 的泳道`} className={cn(GRID, 'rounded-2xl border border-gray-100 bg-white')}>
              <div className="flex items-start gap-2.5 p-4">
                <Avatar member={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900">{m.name}</div>
                  <div className="truncate text-xs text-gray-500">{m.title}</div>
                  <div className={cn('mt-1.5 text-xs tabular-nums', over ? 'font-semibold text-red-600' : 'text-gray-700')}>
                    {load} / {cap} SP
                  </div>
                </div>
              </div>
              {LANES.map((l) => {
                const list = lanes[l.key];
                return (
                  <div
                    key={l.key}
                    className={cn('border-l border-gray-100 p-3 last:rounded-r-2xl', LANE_STYLE[l.key].cell)}
                    aria-label={`${m.name} · ${l.label}`}
                  >
                    <div className="space-y-2">
                      {list.map((t) => (
                        <TaskSummaryCard
                          key={t.id}
                          task={t}
                          lane={l.key}
                          carry={carryIds.has(t.id)}
                          returnedBy={t.negotiation ? memberMap.get(t.negotiation.byId) : undefined}
                          onOpen={() => onOpen(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
