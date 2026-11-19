import { AlertTriangle, Hourglass, ListChecks } from 'lucide-react';
import { Avatar, ProgressBar } from '@/components/ui';
import { TASK_STATES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { checklistProgress } from '@/lib/execution';
import { sum } from '@/lib/format';
import { BOARD_STATES, type BoardState, type ExecutionPlan, type Member, type Task } from '@/types';

/** 四個執行狀態欄的色彩層次（低飽和度，與 Dashboard 任務狀態圖一致） */
const STATE_STYLE: Record<BoardState, { dot: string; header: string; count: string; card: string; cell: string }> = {
  TODO: {
    dot: 'bg-gray-400',
    header: 'border-gray-200 bg-gray-50 text-gray-700',
    count: 'border-gray-200 bg-white text-gray-600',
    card: 'border-gray-200 bg-white hover:border-gray-300',
    cell: '',
  },
  IN_PROGRESS: {
    dot: 'bg-orange-300',
    header: 'border-orange-200/80 bg-orange-50/70 text-orange-800',
    count: 'border-orange-200/60 bg-white text-orange-700',
    card: 'border-orange-200 bg-orange-50/25 hover:border-orange-300',
    cell: 'bg-orange-50/10',
  },
  IN_REVIEW: {
    dot: 'bg-violet-400',
    header: 'border-violet-200/80 bg-violet-50/70 text-violet-800',
    count: 'border-violet-200/60 bg-white text-violet-700',
    card: 'border-violet-200 bg-violet-50/25 hover:border-violet-300',
    cell: 'bg-violet-50/10',
  },
  DONE: {
    dot: 'bg-sky-400',
    header: 'border-sky-200/80 bg-sky-50/70 text-sky-800',
    count: 'border-sky-200/60 bg-white text-sky-700',
    card: 'border-sky-200 bg-sky-50/25 hover:border-sky-300',
    cell: 'bg-sky-50/10',
  },
};

/** 成員欄 + 四個狀態欄；表頭與每條泳道共用同一組欄寬 */
const GRID = 'grid grid-cols-[220px_repeat(4,minmax(0,1fr))]';

interface Props {
  /** 符合目前篩選的任務 */
  tasks: Task[];
  /** 本 Sprint 看板上的全部任務（成員完成進度用，不受篩選影響） */
  allTasks: Task[];
  /** 依顯示順序排好的成員（自己在第一列） */
  members: Member[];
  meId: string;
  isLeader: boolean;
  /** 「全部」時每位成員都顯示；其他篩選只顯示有符合任務的成員 */
  showEmptyRows: boolean;
  memberMap: Map<string, Member>;
  planMap: Map<string, ExecutionPlan>;
  issueCount: Map<string, number>;
  waitingOf: (task: Task) => Task[];
  behindOf: (task: Task) => boolean;
  onOpen: (taskId: string) => void;
}

/** 審查中任務的狀態摘要 */
function reviewLabel(task: Task, memberMap: Map<string, Member>): string {
  const { policy } = task;
  if (policy.mode === 'leader') return '等待 Leader 專審';
  if (policy.mode === 'target') return `指定審查 ${task.approvals.length}/${policy.targets.length}`;
  return task.reviewerId ? `${memberMap.get(task.reviewerId)?.name ?? '成員'} 審查中` : '開放認領';
}

function LaneCard({
  task,
  plan,
  openIssues,
  waitingOn,
  behind,
  memberMap,
  onOpen,
}: {
  task: Task;
  plan: ExecutionPlan | undefined;
  openIssues: number;
  waitingOn: Task[];
  behind: boolean;
  memberMap: Map<string, Member>;
  onOpen: () => void;
}) {
  const state = task.state as BoardState;
  const progress = plan?.confirmedAt ? checklistProgress(plan) : null;
  const tag = 'inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px]';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`開啟 ${task.id} ${task.title}`}
      className={cn(
        'w-full rounded-xl border p-3 text-left transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
        openIssues > 0 ? 'border-red-200 bg-red-50/30 hover:border-red-300' : STATE_STYLE[state].card,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-gray-500">{task.id}</span>
        <span className="text-[11px] font-medium tabular-nums text-gray-700">{task.storyPoints} SP</span>
      </span>
      <span className="mt-1 line-clamp-2 block text-sm leading-snug text-gray-900">{task.title}</span>
      {(openIssues > 0 || waitingOn.length > 0 || behind || progress || state === 'IN_REVIEW') && (
        <span className="mt-2 flex flex-wrap gap-1">
          {openIssues > 0 && (
            <span className={cn(tag, 'border-red-200 bg-white text-red-700')}>
              <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
              被阻礙 · {openIssues}
            </span>
          )}
          {waitingOn.length > 0 && (
            <span className={cn(tag, 'border-orange-200 bg-white text-orange-700')}>
              <Hourglass className="h-3 w-3" strokeWidth={1.75} />
              等待 {waitingOn.map((t) => t.id).join('、')}
            </span>
          )}
          {behind && <span className={cn(tag, 'border-red-200 bg-white text-red-700')}>進度落後</span>}
          {state === 'IN_REVIEW' && (
            <span className={cn(tag, 'border-violet-200 bg-white text-violet-700')}>{reviewLabel(task, memberMap)}</span>
          )}
          {progress && progress.total > 0 && state !== 'DONE' && (
            <span className={cn(tag, 'border-gray-200 bg-white text-gray-600')}>
              <ListChecks className="h-3 w-3" strokeWidth={1.75} />
              執行計畫 {progress.done}/{progress.total}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/**
 * Active Board 的泳道：成員為橫向泳道，貫穿 To Do／In Progress／In Review／Done 四個狀態直欄。
 * 卡片只列重點標籤，回報問題、複製 Prompt 等操作在點開任務後進行。
 */
export function BoardSwimlanes({
  tasks,
  allTasks,
  members,
  meId,
  isLeader,
  showEmptyRows,
  memberMap,
  planMap,
  issueCount,
  waitingOf,
  behindOf,
  onOpen,
}: Props) {
  const rows = members.filter((m) => showEmptyRows || tasks.some((t) => t.assigneeId === m.id));

  return (
    <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0 lg:overflow-visible">
      <div className="min-w-[1000px] space-y-3">
        {/* 固定的狀態表頭 */}
        <div
          className={cn(GRID, 'z-10 items-center rounded-2xl border border-gray-100 bg-white p-2 shadow-[0_0_0_12px_#fff] lg:sticky lg:-top-8')}
          role="row"
        >
          <div className="px-3 text-xs font-medium text-gray-500" role="columnheader">
            成員
          </div>
          {BOARD_STATES.map((s) => {
            const style = STATE_STYLE[s];
            return (
              <div key={s} role="columnheader" className={cn('mx-1 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium', style.header)}>
                <span className={cn('h-2 w-2 rounded-full', style.dot)} aria-hidden />
                {TASK_STATES[s].label}
                <span className={cn('ml-auto rounded-full border px-2 py-0.5 text-xs tabular-nums', style.count)}>
                  {tasks.filter((t) => t.state === s).length} 張
                </span>
              </div>
            );
          })}
        </div>

        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">沒有符合篩選的任務</p>}

        {/* 成員泳道 */}
        {rows.map((m) => {
          const mine = tasks.filter((t) => t.assigneeId === m.id);
          const owned = allTasks.filter((t) => t.assigneeId === m.id);
          const total = sum(owned.map((t) => t.storyPoints));
          const done = sum(owned.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
          const blocked = owned.filter((t) => (issueCount.get(t.id) ?? 0) > 0).length;
          const behind = owned.filter((t) => t.state !== 'DONE' && behindOf(t)).length;
          const self = m.id === meId;
          return (
            <section
              key={m.id}
              aria-label={`${m.name} 的泳道`}
              className={cn(GRID, 'rounded-2xl border border-gray-100 bg-white')}
            >
              {/* 自己的泳道只用名字旁的標籤標示 */}
              <div className="flex items-start gap-2.5 p-4">
                <Avatar member={m} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-gray-900">{m.name}</span>
                    {self && (
                      <span className="shrink-0 rounded-full border border-sky-200 bg-sky-50 px-1.5 text-[10px] font-medium leading-4 text-sky-700">
                        {isLeader ? 'Leader 本人' : '本人'}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-gray-500">{m.title}</div>
                  <div className="mb-1 mt-2 flex items-baseline justify-between text-xs">
                    <span className="text-gray-500">完成</span>
                    <span className="tabular-nums text-gray-900">
                      <span className="font-semibold">{done}</span> / {total} SP
                    </span>
                  </div>
                  <ProgressBar value={done} max={Math.max(total, 1)} tone="sky" size="sm" label={`${m.name} 完成進度`} />
                  {(blocked > 0 || behind > 0) && (
                    <div className="mt-2 space-y-0.5 text-[11px] font-medium text-red-600">
                      {blocked > 0 && <div>{blocked} 項任務被阻礙</div>}
                      {behind > 0 && <div>{behind} 項進度落後</div>}
                    </div>
                  )}
                </div>
              </div>
              {BOARD_STATES.map((s) => {
                const list = mine.filter((t) => t.state === s);
                return (
                  <div key={s} className={cn('space-y-2 border-l border-gray-100 p-3 last:rounded-r-2xl', STATE_STYLE[s].cell)} aria-label={`${m.name} · ${TASK_STATES[s].label}`}>
                    {list.map((t) => (
                      <LaneCard
                        key={t.id}
                        task={t}
                        plan={planMap.get(t.id)}
                        openIssues={issueCount.get(t.id) ?? 0}
                        waitingOn={waitingOf(t)}
                        behind={behindOf(t)}
                        memberMap={memberMap}
                        onOpen={() => onOpen(t.id)}
                      />
                    ))}
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
