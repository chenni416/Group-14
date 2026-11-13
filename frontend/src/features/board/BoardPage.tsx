import { Card, PageHeader, PageSkeleton, ProgressBar, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useMemberMap, useMembers, useSprintContext } from '@/hooks/queries';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { sum } from '@/lib/format';
import { needsMyReview } from '@/lib/permissions';
import { useUiStore, type BoardFilter } from '@/stores/ui.store';
import { BOARD_STATES } from '@/types';
import { KanbanColumn } from './components/KanbanColumn';
import { SprintBanner } from './components/SprintBanner';
import { TaskCard } from './components/TaskCard';

const FILTERS = [
  { value: 'all' as const, label: '全部' },
  { value: 'mine' as const, label: '我的任務' },
  { value: 'review' as const, label: '待我審查' },
];

export function BoardPage() {
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: memberList } = useMembers();
  const members = useMemberMap();
  const drawer = useTaskDrawer();
  const { boardFilter, setBoardFilter } = useUiStore();

  if (ctx.isLoading || !me || !ctx.active) return <PageSkeleton />;

  const { active, boardTasks, planning, planningTasks, planningReady } = ctx;
  const leaderId = memberList?.find((m) => m.role === 'Leader')?.id;
  const visible = boardTasks.filter((t) =>
    boardFilter === 'mine' ? t.assigneeId === me.id : boardFilter === 'review' ? needsMyReview(t, me.id) : true,
  );
  const total = sum(boardTasks.map((t) => t.storyPoints));
  const done = sum(boardTasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));

  return (
    <>
      <PageHeader
        eyebrow={`${active.name} · ${active.start} – ${active.end}`}
        title="Active Board"
        actions={<SegmentedControl<BoardFilter> options={FILTERS} value={boardFilter} onChange={setBoardFilter} aria-label="篩選" />}
      />

      {planning?.status === 'planning' && planningTasks.length > 0 && (
        <SprintBanner sprint={planning} tasks={planningTasks} ready={planningReady} canStart={me.role === 'Leader'} />
      )}

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Sprint Goal</div>
          <div className="mt-1 text-base font-medium text-gray-900">{active.goal || '—'}</div>
        </div>
        <div className="w-full sm:w-72">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-500">完成度</span>
            <span className="font-semibold tabular-nums">
              {done}/{total} SP
            </span>
          </div>
          <ProgressBar value={done} max={total} tone="sky" size="md" label="Sprint 完成度" />
        </div>
      </Card>

      <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1080px] grid-cols-4 gap-4 xl:min-w-0">
          {BOARD_STATES.map((state) => {
            const col = visible.filter((t) => t.state === state);
            return (
              <KanbanColumn key={state} state={state} count={col.length}>
                {col.map((t) => (
                  <TaskCard key={t.id} task={t} members={members} leaderId={leaderId} userId={me.id} onOpen={drawer.open} />
                ))}
              </KanbanColumn>
            );
          })}
        </div>
      </div>
    </>
  );
}
