import { useState } from 'react';
import { PageHeader, PageSkeleton, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useMembers, useSprintContext } from '@/hooks/queries';
import { useExecutionPlans } from '@/hooks/useCollab';
import { isLead } from '@/lib/permissions';
import { BOARD_STATES, type ReviewPolicy } from '@/types';
import { DEMO_PROJECTS, useProjectStore } from '@/stores/project.store';
import { ActivityFeed } from './components/ActivityFeed';
import { BurndownChart } from './components/BurndownChart';
import { DemoMyTasksCard } from './components/DemoMyTasksCard';
import { MyTasksCard } from './components/MyTasksCard';
import { PlanningProgress } from './components/PlanningProgress';
import { ProjectOverviewCard } from './components/ProjectOverviewCard';
import { ReviewQueue } from './components/ReviewQueue';
import { StatusDonut } from './components/StatusDonut';
import { TeamLoad } from './components/TeamLoad';

const DEFAULT_POLICY: ReviewPolicy = { mode: 'pool', targets: [], rule: 'any' };

type Tab = 'overview' | 'team' | 'charts';

/**
 * Project Dashboard，分三個分頁切換，不需往下捲動：
 * Sprint 概況（專案資訊、最新動態、我的任務）、團隊規劃（下個 Sprint 規劃進度、Review 佇列、團隊負載）、進度圖表（任務狀態與 Burndown）。
 * Taskline 使用真實資料，其他示意專案使用 project.store 的假資料，呈現相同的內容。
 */
export function DashboardPage() {
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const { data: plans = [] } = useExecutionPlans();
  const currentId = useProjectStore((s) => s.currentId);
  const [tab, setTab] = useState<Tab>('overview');

  if (ctx.isLoading || !me) return <PageSkeleton />;

  const { project, boardTasks, active, planning, planningTasks, allTasks } = ctx;
  // 切換到其他 demo 專案時，改用寫死的示意資料
  const demo = DEMO_PROJECTS.find((p) => p.id === currentId);
  const isMain = !demo || demo.id === 'taskline';
  const lead = isLead(me);
  const goal = isMain ? project?.goal : demo.goal;

  // 各卡片使用的資料：Taskline 用真實資料，示意專案用假資料
  const demoBoard = demo ? demo.tasks.filter((t) => (BOARD_STATES as readonly string[]).includes(t.state)) : [];
  const board = isMain ? boardTasks : demoBoard.map((t) => ({ ...t, policy: t.policy ?? DEFAULT_POLICY, reviewerId: t.reviewerId ?? null }));
  const shownMembers = isMain ? members : members.slice(0, demo.memberCount);
  const nextSprint = isMain
    ? { sprint: planning?.status === 'planning' ? planning : undefined, tasks: planning?.status === 'planning' ? planningTasks : [] }
    : { sprint: demo.planning ? { name: demo.planning.name } : undefined, tasks: (demo.planning?.states ?? []).map((state) => ({ state })) };

  return (
    <>
      <PageHeader
        eyebrow={goal ? `專案目標：${goal}` : '管理並追蹤你的專案'}
        title="Project Dashboard"
        actions={
          <SegmentedControl<Tab>
            aria-label="檢視"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Sprint 概況' },
              { value: 'team', label: '團隊規劃' },
              { value: 'charts', label: '進度圖表' },
            ]}
          />
        }
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {project && <ProjectOverviewCard project={project} sprint={active} tasks={boardTasks} members={members} />}
            {isMain ? <ActivityFeed /> : <ActivityFeed items={demo.activity} />}
          </div>
          <div className="[&>*]:h-full">
            {isMain ? (
              <MyTasksCard tasks={allTasks} userId={me.id} canPlan={lead} plans={plans} />
            ) : (
              <DemoMyTasksCard tasks={demo.tasks} userId={me.id} />
            )}
          </div>
        </div>
      )}

      {tab === 'charts' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <StatusDonut tasks={board} />
          {isMain ? <BurndownChart sprintId={active?.id} /> : <BurndownChart sprintId={undefined} points={demo.burndown} />}
        </div>
      )}

      {tab === 'team' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            {/* 示意專案沒有實際的規劃流程，不提供前往 Planning Studio 的按鈕 */}
            <PlanningProgress sprint={nextSprint.sprint} tasks={nextSprint.tasks} canPlan={isMain && lead} />
          </div>
          <ReviewQueue tasks={board} />
          <TeamLoad members={shownMembers} tasks={board} sprint={isMain ? active : { name: demo.sprintName }} />
        </div>
      )}
    </>
  );
}
