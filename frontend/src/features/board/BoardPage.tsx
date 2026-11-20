import { AlertTriangle, ClipboardList, Flag, Lightbulb } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Callout, Card, PageHeader, PageSkeleton, ProgressBar, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useMemberMap, useMembers, useSprintContext } from '@/hooks/queries';
import { useExecutionPlans, useIssues, useProposals } from '@/hooks/useCollab';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { isOpenIssue } from '@/lib/collab';
import { blockedBy, demoToday, isBehind } from '@/lib/execution';
import { sum } from '@/lib/format';
import { isLead, needsMyReview } from '@/lib/permissions';
import { useUiStore, type BoardFilter } from '@/stores/ui.store';
import type { Task } from '@/types';
import { BoardSwimlanes } from './components/BoardSwimlanes';
import { EndSprintDialog } from './components/EndSprintDialog';
import { SprintBanner } from './components/SprintBanner';

const FILTERS = [
  { value: 'all' as const, label: '全部' },
  { value: 'mine' as const, label: '我的任務' },
  { value: 'review' as const, label: '待我審查' },
  { value: 'blocked' as const, label: '有阻礙' },
];

export function BoardPage() {
  const navigate = useNavigate();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: memberList } = useMembers();
  const { data: plans = [] } = useExecutionPlans();
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const members = useMemberMap();
  const drawer = useTaskDrawer();
  const { boardFilter, setBoardFilter, setCollabPanel } = useUiStore();
  const endDialog = useDisclosure();

  const planMap = useMemo(() => new Map(plans.map((p) => [p.taskId, p])), [plans]);
  const taskMap = useMemo(() => new Map<string, Task>(ctx.allTasks.map((t) => [t.id, t])), [ctx.allTasks]);
  const issueCount = useMemo(() => {
    const m = new Map<string, number>();
    issues.filter(isOpenIssue).forEach((i) => m.set(i.taskId, (m.get(i.taskId) ?? 0) + 1));
    return m;
  }, [issues]);

  if (ctx.isLoading || !me || !ctx.active) return <PageSkeleton />;

  const { active, boardTasks, planning, planningTasks, planningReady } = ctx;
  // 自己在第一列，其他人依團隊名單順序
  const orderedMembers = [...(memberList ?? [])].sort((a, b) => Number(b.id === me.id) - Number(a.id === me.id));
  const today = demoToday(active);
  const visible = boardTasks.filter((t) =>
    boardFilter === 'mine'
      ? t.assigneeId === me.id
      : boardFilter === 'review'
        ? needsMyReview(t, me.id)
        : boardFilter === 'blocked'
          ? (issueCount.get(t.id) ?? 0) > 0
          : true,
  );
  const total = sum(boardTasks.map((t) => t.storyPoints));
  const done = sum(boardTasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const openIssues = issues.filter(isOpenIssue).length;
  const openProposals = proposals.filter((p) => p.status === 'open').length;
  const ended = active.status === 'closed';

  return (
    <>
      <PageHeader
        eyebrow={`${active.name} · ${active.start} – ${active.end}`}
        title="Active Board"
        actions={
          <>
            <SegmentedControl<BoardFilter> options={FILTERS} value={boardFilter} onChange={setBoardFilter} aria-label="篩選" />
            <Button size="sm" onClick={() => navigate(`/sprints/${active.id}/brief`)}>
              <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sprint 總覽
            </Button>
            <Button size="sm" onClick={() => setCollabPanel('issues')}>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              問題 {openIssues}
            </Button>
            <Button size="sm" onClick={() => setCollabPanel('proposals')}>
              <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} />
              提案 {openProposals}
            </Button>
            {isLead(me) && active.status === 'active' && (
              <Button size="sm" variant="primary" onClick={endDialog.open}>
                <Flag className="h-3.5 w-3.5" strokeWidth={1.75} />
                結束 Sprint
              </Button>
            )}
          </>
        }
      />

      {ended && (
        <Callout tone="warning" className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span>{active.name} 已結束，看板內容唯讀。到 Retrospective 回顧這個 Sprint，並訂出下一輪的改善行動。</span>
          <Button size="sm" variant="primary" onClick={() => navigate(`/sprints/${active.id}/retro`)}>
            前往回顧
          </Button>
        </Callout>
      )}

      {planning?.status === 'planning' && planningTasks.length > 0 && (
        <SprintBanner sprint={planning} tasks={planningTasks} ready={planningReady} canStart={me.role === 'Leader'} />
      )}

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-6 p-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Sprint Goal</div>
          <div className="mt-1 text-base font-medium text-gray-900">{active.goal || '—'}</div>
          {ctx.project?.goal && <div className="mt-1 text-xs text-gray-500">專案目標：{ctx.project.goal}</div>}
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

      <BoardSwimlanes
        tasks={visible}
        allTasks={boardTasks}
        members={orderedMembers}
        meId={me.id}
        isLeader={isLead(me)}
        showEmptyRows={boardFilter === 'all'}
        memberMap={members}
        planMap={planMap}
        issueCount={issueCount}
        waitingOf={(t) => blockedBy(t, taskMap)}
        behindOf={(t) => isBehind(planMap.get(t.id), today)}
        onOpen={drawer.open}
      />

      <EndSprintDialog open={endDialog.isOpen} onClose={endDialog.close} sprint={active} tasks={ctx.allTasks} />
    </>
  );
}
