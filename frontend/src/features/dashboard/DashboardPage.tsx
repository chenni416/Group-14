import { useNavigate } from 'react-router-dom';
import { PageHeader, PageSkeleton, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useMembers, useSprintContext } from '@/hooks/queries';
import { CHART_COLORS } from '@/lib/constants';
import { sum } from '@/lib/format';
import { isLead, needsMyReview } from '@/lib/permissions';
import { BurndownChart } from './components/BurndownChart';
import { MyTasksCard } from './components/MyTasksCard';
import { PlanningProgress } from './components/PlanningProgress';
import { ReviewQueue } from './components/ReviewQueue';
import { StatTiles } from './components/StatTiles';
import { StatusDonut } from './components/StatusDonut';
import { TeamLoad } from './components/TeamLoad';

export function DashboardPage() {
  const navigate = useNavigate();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members } = useMembers();

  if (ctx.isLoading || !me) return <PageSkeleton />;

  const { boardTasks, active, planning, planningTasks, allTasks } = ctx;
  const total = sum(boardTasks.map((t) => t.storyPoints));
  const done = sum(boardTasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const actionCount = allTasks.filter(
    (t) => (t.assigneeId === me.id && t.state === 'PENDING_MEMBER') || needsMyReview(t, me.id),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="管理並追蹤你的專案"
        title="Project Dashboard"
        actions={
          <SegmentedControl
            aria-label="檢視"
            value="overview"
            onChange={(v) => v === 'board' && navigate('/board')}
            options={[
              { value: 'overview', label: active?.name ?? 'Sprint' },
              { value: 'board', label: '看板' },
            ]}
          />
        }
      />
      <div className="space-y-6">
        <StatTiles
          stats={[
            { label: 'Sprint 完成度', value: `${total ? Math.round((done / total) * 100) : 0}%`, hint: `${done} / ${total} SP`, accent: CHART_COLORS.sky },
            { label: '進行中', value: boardTasks.filter((t) => t.state === 'IN_PROGRESS').length, hint: '項任務', accent: CHART_COLORS.orange },
            { label: '審查中', value: boardTasks.filter((t) => t.state === 'IN_REVIEW').length, hint: '項任務', accent: CHART_COLORS.violet },
            { label: '待我處理', value: actionCount, hint: '指派確認與審查' },
          ]}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:row-span-3 [&>*]:h-full">
            <MyTasksCard tasks={allTasks} userId={me.id} canPlan={isLead(me)} />
          </div>
          <StatusDonut tasks={boardTasks} />
          <BurndownChart sprintId={active?.id} />
          <div className="lg:col-span-2">
            <ReviewQueue tasks={boardTasks} />
          </div>
          <div className="lg:col-span-2">
            <PlanningProgress
              sprint={planning?.status === 'planning' ? planning : undefined}
              tasks={planning?.status === 'planning' ? planningTasks : []}
              canPlan={isLead(me)}
            />
          </div>
          <div className="lg:col-span-3">
            <TeamLoad members={members ?? []} tasks={boardTasks} sprint={active} />
          </div>
        </div>
      </div>
    </>
  );
}
