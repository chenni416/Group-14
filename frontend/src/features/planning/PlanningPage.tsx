import { ArrowRight, Sparkles } from 'lucide-react';
import { RequireLeader } from '@/components/layout/RequireLeader';
import { Button, Card, EmptyState, PageHeader, PageSkeleton } from '@/components/ui';
import { useDocs, useMembers, useSprintContext } from '@/hooks/queries';
import { AnalyzeProgress } from './components/AnalyzeProgress';
import { PlanningStepper } from './components/PlanningStepper';
import { SourceContext } from './components/SourceContext';
import { SubmittedPlanBoard } from './components/SubmittedPlanBoard';
import { usePlanningMutations } from './hooks/usePlanning';
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
 * Sprint 規劃：0 設定 → A Story 審核 → B Task 拆解與派工 → C 派工總覽與發送。
 * 規劃送出後改為滿版泳道追蹤看板。
 */
function PlanningStudio() {
  const ctx = useSprintContext();
  const { data: members = [] } = useMembers();
  const { data: docs } = useDocs();
  const { stage, draft, setStage } = usePlanningStore();
  const { generate } = usePlanningMutations();

  if (ctx.isLoading) return <PageSkeleton />;

  const sprint = ctx.planning;
  if (!sprint || sprint.status !== 'planning') {
    return (
      <>
        <PageHeader eyebrow="Sprint Planning Studio" title="Sprint 規劃" />
        <EmptyState icon={Sparkles} title="目前沒有規劃中的 Sprint" description={`${sprint?.name ?? 'Sprint'} 已啟動，可至 Active Board 追蹤進度。`} />
      </>
    );
  }

  // 已核准並發送派工通知：不再回到設定畫面
  if (ctx.planningTasks.length > 0) {
    return <SubmittedPlanBoard sprint={sprint} tasks={ctx.planningTasks} members={members} ready={ctx.planningReady} />;
  }

  return (
    <>
      <PageHeader eyebrow="Sprint Planning Studio" title={`${sprint.name} 規劃`} align="center" className="mb-6" actions={<PlanningStepper />} />

      {stage === 'setup' && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <SourceContext
            sprint={sprint}
            analyzing={generate.isPending}
            hasDraft={!!draft}
            onAnalyze={(goal, minutes) => generate.mutate({ goal, minutes })}
          />
          {generate.isPending ? (
            <Card>
              <AnalyzeProgress docCount={docs?.length ?? 0} />
            </Card>
          ) : draft ? (
            <Card>
              <EmptyState
                icon={Sparkles}
                title="已有規劃草稿"
                description={`${draft.stories.length} 個 Story、${draft.tasks.length ? `${draft.tasks.length} 張 Task` : '尚未拆解 Task'}。修改設定後可重新分析，或直接回到審核工作區。`}
              />
              <div className="flex justify-center pb-4">
                <Button variant="primary" onClick={() => setStage('stories')}>
                  回到審核工作區
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={Sparkles}
                title="還沒有規劃內容"
                description="在左側確認 Sprint Goal 與會議紀錄後，按「AI Analyze & Decompose」開始分析"
              />
            </Card>
          )}
        </div>
      )}

      {stage === 'stories' && <StoryReviewStep members={members} />}
      {stage === 'tasks' && <TaskBreakdownStep members={members} />}
      {stage === 'review' && <FinalReviewStep members={members} />}
    </>
  );
}
