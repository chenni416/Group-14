import { useNavigate } from 'react-router-dom';
import { PageHeader, PageSkeleton, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useMembers, useSprintContext } from '@/hooks/queries';
import { CHART_COLORS } from '@/lib/constants';
import { sum } from '@/lib/format';
import { needsMyReview } from '@/lib/permissions';
import { DEMO_PROJECTS, useProjectStore } from '@/stores/project.store';
import { ActivityFeed } from './components/ActivityFeed';
import { BurndownChart } from './components/BurndownChart';
import { DemoMyTasksCard } from './components/DemoMyTasksCard';
import { MyTasksCard } from './components/MyTasksCard';
import { PlanningProgress } from './components/PlanningProgress';
import { ProjectOverviewCard } from './components/ProjectOverviewCard';
import { ReviewQueue } from './components/ReviewQueue';
import { StatTiles } from './components/StatTiles';
import { StatusDonut } from './components/StatusDonut';
import { TeamLoad } from './components/TeamLoad';

export function DashboardPage() {
  const navigate = useNavigate();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members } = useMembers();
  const currentId = useProjectStore((s) => s.currentId);

  if (ctx.isLoading || !me) return <PageSkeleton />;

  const { project, boardTasks, active, planning, planningTasks, allTasks } = ctx;
  const total = sum(boardTasks.map((t) => t.storyPoints));
  const done = sum(boardTasks.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const actionCount = allTasks.filter(
    (t) => (t.assigneeId === me.id && t.state === 'PENDING_MEMBER') || needsMyReview(t, me.id),
  ).length;

  // 切換到其他 demo 專案時，統計卡改用寫死的數字
  const demo = DEMO_PROJECTS.find((p) => p.id === currentId);
  const isMain = !demo || demo.id === 'taskline';
  const stat = isMain
    ? {
        done,
        total,
        inProgress: boardTasks.filter((t) => t.state === 'IN_PROGRESS').length,
        inReview: boardTasks.filter((t) => t.state === 'IN_REVIEW').length,
        action: actionCount,
      }
    : { done: demo.done, total: demo.total, inProgress: demo.inProgress, inReview: demo.inReview, action: demo.action };

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
            { label: 'Sprint 完成度', value: `${stat.total ? Math.round((stat.done / stat.total) * 100) : 0}%`, hint: `${stat.done} / ${stat.total} SP`, accent: CHART_COLORS.sky },
            { label: '進行中', value: stat.inProgress, hint: '項任務', accent: CHART_COLORS.orange },
            { label: '審查中', value: stat.inReview, hint: '項任務', accent: CHART_COLORS.violet },
            { label: '待我處理', value: stat.action, hint: '指派確認與審查' },
          ]}
        />
        {/* 上半部：左 2/3 專案資訊、右 1/3 我的任務 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {project && (
              <ProjectOverviewCard project={project} sprint={active} tasks={boardTasks} members={members ?? []} />
            )}
            {isMain && <ActivityFeed />}
          </div>
          <div className="[&>*]:h-full">
            {isMain ? <MyTasksCard tasks={allTasks} userId={me.id} /> : <DemoMyTasksCard tasks={demo.tasks} userId={me.id} />}
          </div>
        </div>

        {/* 下半部：Sprint 統計圖表（只有 Taskline 有真實資料） */}
        {isMain && (
        <div className="grid gap-6 lg:grid-cols-2">
          <StatusDonut tasks={boardTasks} />
          <BurndownChart sprintId={active?.id} />
          <div className="lg:col-span-2">
            <ReviewQueue tasks={boardTasks} />
          </div>
          <div className="lg:col-span-2">
            <PlanningProgress sprint={planning?.status === 'planning' ? planning : undefined} tasks={planning?.status === 'planning' ? planningTasks : []} />
          </div>
          <div className="lg:col-span-2">
            <TeamLoad members={members ?? []} tasks={boardTasks} sprint={active} />
          </div>
        </div>
        )}
      </div>
    </>
  );
}