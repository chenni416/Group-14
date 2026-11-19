import { useEffect } from 'react';
import { RequireLeader } from '@/components/layout/RequireLeader';
import { PageHeader, PageSkeleton } from '@/components/ui';
import { useMembers } from '@/hooks/queries';
import { DeferDialog } from './components/DeferDialog';
import { PlanningStepper } from './components/PlanningStepper';
import { RestoreDialog } from './components/RestoreDialog';
import { SprintSetup } from './components/SprintSetup';
import { SubmittedPlanBoard } from './components/SubmittedPlanBoard';
import { usePlanCapacity } from './hooks/usePlanCapacity';
import { CarryReviewStep, useCarryReview } from './steps/CarryReviewStep';
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
 * Sprint 規劃：1 上輪 Sprint 統整 → 2 開啟 Sprint 與設定 → 3 Story 審核 → 4 Task 拆解與派工 → 5 派工總覽與發送。
 * 沒有規劃中的 Sprint 時為新建模式（統整與設定）；規劃送出後改為滿版泳道追蹤看板。
 */
function PlanningStudio() {
  const ctx = useCarryReview();
  const { data: members = [] } = useMembers();
  // Story／Task／派工總覽的容量 = 本輪 Capacity − 帶入任務佔用
  const { planMembers } = usePlanCapacity(members);
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

  // 統整尚未完成時只能停在階段 1；新建模式只有統整與設定兩個階段
  const current = !ctx.ready ? 'carry' : sprint || stage === 'carry' ? stage : 'setup';

  return (
    <>
      <PageHeader
        eyebrow="Sprint Planning Studio"
        title={sprint ? `${sprint.name} 規劃` : '建立 Sprint'}
        align="center"
        className="mb-6"
        actions={<PlanningStepper carryReady={ctx.ready} />}
      />

      {current === 'carry' && <CarryReviewStep members={members} />}
      {current === 'setup' && <SprintSetup sprint={sprint} />}
      {current === 'stories' && <StoryReviewStep members={planMembers} />}
      {current === 'tasks' && <TaskBreakdownStep members={planMembers} />}
      {current === 'review' && <FinalReviewStep members={planMembers} />}
      <DeferDialog />
      <RestoreDialog />
    </>
  );
}
