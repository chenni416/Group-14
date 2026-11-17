import { useEffect } from 'react';
import { RequireLeader } from '@/components/layout/RequireLeader';
import { PageHeader, PageSkeleton } from '@/components/ui';
import { useMembers, useSprintContext } from '@/hooks/queries';
import { PlanningStepper } from './components/PlanningStepper';
import { SprintSetup } from './components/SprintSetup';
import { SubmittedPlanBoard } from './components/SubmittedPlanBoard';
import { FinalReviewStep } from './steps/FinalReviewStep';
import { StoryReviewStep } from './steps/StoryReviewStep';
import { TaskBreakdownStep } from './steps/TaskBreakdownStep';
import { usePlanningStore } from './store';

export function PlanningPage() {
  return (
    <RequireLeader>
      <PlanningStudio />
    </RequireLeader>
  );
}

/**
 * Sprint 規劃：0 開啟 Sprint 與設定 → A Story 審核 → B Task 拆解與派工 → C 派工總覽與發送。
 * 沒有規劃中的 Sprint 時直接進入新建模式；規劃送出後改為滿版泳道追蹤看板。
 */
function PlanningStudio() {
  const ctx = useSprintContext();
  const { data: members = [] } = useMembers();
  const { stage, draft, reset } = usePlanningStore();
  const sprint = ctx.planning?.status === 'planning' ? ctx.planning : undefined;

  // 草稿只存在記憶體中：規劃中的 Sprint 換了（或沒有了）就清掉，避免舊 Sprint 的 Story 帶進新 Sprint
  useEffect(() => {
    if (draft && draft.sprintId !== sprint?.id) reset();
  }, [draft, sprint, reset]);

  if (ctx.isLoading) return <PageSkeleton />;

  // 已核准並發送派工通知：不再回到設定畫面
  if (sprint && ctx.planningTasks.length > 0) {
    return <SubmittedPlanBoard sprint={sprint} tasks={ctx.planningTasks} members={members} ready={ctx.planningReady} />;
  }

  // 新建模式只有設定階段
  const current = sprint ? stage : 'setup';

  return (
    <>
      <PageHeader
        eyebrow="Sprint Planning Studio"
        title={sprint ? `${sprint.name} 規劃` : '建立 Sprint'}
        align="center"
        className="mb-6"
        actions={<PlanningStepper />}
      />

      {current === 'setup' && <SprintSetup sprint={sprint} />}
      {current === 'stories' && <StoryReviewStep members={members} />}
      {current === 'tasks' && <TaskBreakdownStep members={members} />}
      {current === 'review' && <FinalReviewStep members={members} />}
    </>
  );
}
