import { ChevronRight, Play, Plus, Send, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, PageSkeleton } from '@/components/ui';
import { useCurrentUser, useDocs, useMemberMap, useMembers, useSprintContext } from '@/hooks/queries';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useIsMutating } from '@tanstack/react-query';
import { sum } from '@/lib/format';
import { isLead as isLeadRole } from '@/lib/permissions';
import { BOARD_STATES, DRAFT_STATES } from '@/types';
import { useStartSprint } from '@/features/board/hooks/useStartSprint';
import { AnalyzeProgress } from './components/AnalyzeProgress';
import { CapacityStrip } from './components/CapacityStrip';
import { DraftTaskCard } from './components/DraftTaskCard';
import { ManualTaskDialog } from './components/ManualTaskDialog';
import { SourceContext } from './components/SourceContext';
import { DECOMPOSE_KEY, usePlanningMutations } from './hooks/usePlanning';
import { groupByEpic, plannedLoad } from './lib/load';

export function PlanningPage() {
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const { data: docs } = useDocs();
  const memberMap = useMemberMap();
  const manual = useDisclosure();
  const { approveDrafts } = usePlanningMutations();
  const startSprint = useStartSprint();
  const analyzing = useIsMutating({ mutationKey: DECOMPOSE_KEY }) > 0;

  const planningTasks = useMemo(
    () => ctx.planningTasks.filter((t) => !(BOARD_STATES as readonly string[]).includes(t.state)),
    [ctx.planningTasks],
  );
  const load = useMemo(() => plannedLoad(members, ctx.planningTasks), [members, ctx.planningTasks]);
  const epics = useMemo(() => groupByEpic(planningTasks), [planningTasks]);

  if (ctx.isLoading || !me) return <PageSkeleton />;

  const sprint = ctx.planning;
  if (!sprint || sprint.status !== 'planning') {
    return (
      <>
        <PageHeader eyebrow="Sprint Planning Studio" title="Sprint 規劃" />
        <EmptyState icon={Sparkles} title="目前沒有規劃中的 Sprint" description={`${sprint?.name ?? 'Sprint'} 已啟動，可至 Active Board 追蹤進度。`} />
      </>
    );
  }

  const lead = isLeadRole(me);
  const all = ctx.planningTasks;
  const drafts = all.filter((t) => DRAFT_STATES.includes(t.state));
  const ready = ctx.planningReady;

  return (
    <>
      <PageHeader
        eyebrow="Sprint Planning Studio"
        title={`${sprint.name} 規劃`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="violet" dot>AI Suggestion</Badge>
            <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.75} />
            <Badge tone="orange" dot>Leader Approved</Badge>
            <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.75} />
            <Badge tone="sky" dot>Member Accepted</Badge>
          </div>
        }
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <SourceContext sprint={sprint} isLead={lead} />

        <Card>
          <CardHeader
            title="Review & Approval Workspace"
            action={
              <span className="text-sm tabular-nums text-gray-500">
                {planningTasks.length} 項 · {sum(planningTasks.map((t) => t.storyPoints))} SP
              </span>
            }
          />
          {analyzing ? (
            <AnalyzeProgress docCount={docs?.length ?? 0} />
          ) : planningTasks.length === 0 ? (
            <EmptyState icon={Sparkles} title="還沒有任務" description="在左側貼上會議紀錄後，按「AI Analyze & Decompose」" />
          ) : (
            <>
              <CapacityStrip members={members} load={load} />
              <div className="space-y-8">
                {[...epics.entries()].map(([epic, stories]) => (
                  <section key={epic}>
                    <div className="mb-3 flex items-center gap-2">
                      <Badge tone="dark">EPIC</Badge>
                      <h3 className="text-base font-semibold tracking-tight">{epic}</h3>
                    </div>
                    <div className="space-y-5 border-l border-gray-100 pl-4">
                      {[...stories.entries()].map(([story, list]) => (
                        <div key={story}>
                          <div className="mb-2 flex items-center gap-2 text-sm">
                            <Badge>STORY</Badge>
                            <span className="text-gray-700">{story}</span>
                            <span className="ml-auto text-xs tabular-nums text-gray-500">{sum(list.map((t) => t.storyPoints))} SP</span>
                          </div>
                          <div className="space-y-3">
                            {list.map((t) => (
                              <DraftTaskCard key={t.id} task={t} members={members} memberMap={memberMap} load={load} isLead={lead} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}

          {(planningTasks.length > 0 || all.length > 0) && !analyzing && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" disabled={!lead} onClick={manual.open}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  手動新增任務
                </Button>
                {ready ? (
                  <Badge tone="sky" dot>
                    {all.length} 項任務全部被接受
                  </Badge>
                ) : (
                  <span className="text-xs tabular-nums text-gray-500">
                    待確認 {all.filter((t) => t.state === 'PENDING_MEMBER').length} · 退回{' '}
                    {all.filter((t) => t.state === 'RETURNED').length} · 已接受 {all.filter((t) => t.state === 'ASSIGNED').length}
                  </span>
                )}
              </div>
              {ready ? (
                <Button
                  variant="primary"
                  disabled={me.role !== 'Leader'}
                  title={me.role === 'Leader' ? undefined : '只有 Leader 可以啟動 Sprint'}
                  loading={startSprint.isPending}
                  onClick={() => startSprint.mutate(sprint.id)}
                >
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                  Start Sprint
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={!drafts.length || !lead}
                  loading={approveDrafts.isPending}
                  onClick={() => approveDrafts.mutate()}
                >
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                  核准並發送指派邀請（{drafts.length}）
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
      <ManualTaskDialog open={manual.isOpen} onClose={manual.close} members={members} />
    </>
  );
}
