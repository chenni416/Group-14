import { useIsMutating } from '@tanstack/react-query';
import { ChevronRight, List, Play, Plus, Send, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, SegmentedControl } from '@/components/ui';
import { useCurrentUser, useDependencies, useDocs, useMemberMap, useMembers, useSprintContext } from '@/hooks/queries';
import { useDisclosure } from '@/hooks/useDisclosure';
import { sum } from '@/lib/format';
import { isLead as isLeadRole } from '@/lib/permissions';
import { capTotal, carrySP, deferSuggestions, planLoad, preflight } from '@/lib/planning';
import { DRAFT_STATES, type PlanningStep, type ReviewPolicy, type Task } from '@/types';
import { useStartSprint } from '@/features/board/hooks/useStartSprint';
import { AnalyzeProgress } from './components/AnalyzeProgress';
import { CapacityStrip } from './components/CapacityStrip';
import { DependencyPanel } from './components/DependencyPanel';
import { DeferredList } from './components/DeferredList';
import { DraftTaskCard } from './components/DraftTaskCard';
import { EditableLegend } from './components/EditableField';
import { ManualTaskDialog } from './components/ManualTaskDialog';
import { PlanningSteps } from './components/PlanningSteps';
import { PreflightDialog } from './components/PreflightDialog';
import { PrevSprintReview } from './components/PrevSprintReview';
import { ReturnedTasks } from './components/ReturnedTasks';
import { SourceContext, type NotesMode } from './components/SourceContext';
import { DECOMPOSE_KEY, usePlanningMutations } from './hooks/usePlanning';
import { groupByEpic } from './lib/load';

const FALLBACK_POLICY = { mode: 'pool', targets: [], rule: 'any' } as const satisfies ReviewPolicy;

export function PlanningPage() {
  const navigate = useNavigate();
  const ctx = useSprintContext();
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const { data: docs } = useDocs();
  const memberMap = useMemberMap();
  const sprint = ctx.planning?.status === 'planning' ? ctx.planning : undefined;
  const { data: dependencies = [] } = useDependencies(sprint?.id);
  const { approveDrafts, deferSuggested, rebalance } = usePlanningMutations();
  const startSprint = useStartSprint();
  const analyzing = useIsMutating({ mutationKey: DECOMPOSE_KEY }) > 0;

  const [notesMode, setNotesMode] = useState<NotesMode>('edit');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [view, setView] = useState<'tasks' | 'deps'>('tasks');
  const [manualSource, setManualSource] = useState('');
  const manual = useDisclosure();
  const check = useDisclosure();
  const selectionRef = useRef<() => string>(() => '');

  const { planningTasks: all, carryTasks, deferredTasks, previous } = ctx;
  const load = useMemo(() => planLoad(members, all, carryTasks), [members, all, carryTasks]);
  const workTasks = useMemo(() => all.filter((t) => t.state !== 'RETURNED'), [all]);
  const returned = useMemo(() => all.filter((t) => t.state === 'RETURNED'), [all]);
  const epics = useMemo(() => groupByEpic(workTasks), [workTasks]);
  const taskMap = useMemo(() => new Map<string, Task>(ctx.allTasks.map((t) => [t.id, t])), [ctx.allTasks]);

  if (ctx.isLoading || !me) return <PageSkeleton />;

  if (!sprint) {
    return (
      <>
        <PageHeader eyebrow="Sprint Planning Studio" title="Sprint 規劃" />
        <Card>
          <EmptyState icon={Sparkles} title="目前沒有規劃中的 Sprint" description="到 Sprint 列表建立 Sprint，填入本次 Capacity、會議紀錄與文件資料。" />
          <div className="flex justify-center">
            <Button variant="primary" onClick={() => navigate('/sprints')}>
              前往 Sprint 列表
            </Button>
          </div>
        </Card>
      </>
    );
  }

  const lead = isLeadRole(me);
  const leaderName = members.find((m) => m.role === 'Leader')?.name;
  const drafts = all.filter((t) => DRAFT_STATES.includes(t.state));
  const planContext = { sprint, members, planTasks: all, carryTasks, dependencies };
  const result = preflight(planContext);
  const suggestions = lead && drafts.length ? deferSuggestions(planContext) : [];
  const step: PlanningStep = analyzing ? 2 : sprint.step >= 4 && !drafts.length ? 4 : sprint.step >= 3 ? 3 : 1;
  const count = (states: string[]) => all.filter((t) => states.includes(t.state)).length;

  const showSource = (source: string) => {
    setHighlight(source);
    setNotesMode('view');
  };
  const openManual = (source: string) => {
    setManualSource(source.replace(/\s+/g, ' ').trim());
    manual.open();
  };
  const back = () => {
    setFlagged(true);
    check.close();
    setTimeout(() => document.querySelector('.ring-red-50')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  };

  return (
    <>
      <PageHeader
        eyebrow="Sprint Planning Studio"
        title={`${sprint.name} 規劃`}
        actions={
          <>
            <div className="hidden flex-wrap items-center gap-1.5 md:flex">
              <Badge tone="violet" dot>AI Suggestion</Badge>
              <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.75} />
              <Badge tone="orange" dot>Leader Approved</Badge>
              <ChevronRight className="h-4 w-4 text-gray-300" strokeWidth={1.75} />
              <Badge tone="sky" dot>Member Accepted</Badge>
            </div>
            <Button size="sm" onClick={() => navigate('/sprints')}>
              <List className="h-3.5 w-3.5" strokeWidth={1.75} />
              Sprint 列表
            </Button>
          </>
        }
      />
      <PlanningSteps current={step} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <SourceContext
          sprint={sprint}
          isLead={lead}
          step={step}
          mode={notesMode}
          onModeChange={setNotesMode}
          highlight={highlight}
          onAddFromLine={openManual}
          selectionRef={selectionRef}
          onDecomposed={() => setNotesMode('view')}
        />

        <Card>
          <CardHeader
            title="Review & Approval Workspace"
            description={
              <span className="flex flex-wrap items-center gap-2">
                <EditableLegend />
                <span className="tabular-nums">
                  {workTasks.length} 項 · {sum(workTasks.map((t) => t.storyPoints))} SP
                </span>
              </span>
            }
            action={
              <Button variant="primary" disabled={!lead || analyzing} onClick={() => openManual(selectionRef.current())}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                新增任務
              </Button>
            }
          />

          {analyzing ? (
            <AnalyzeProgress docCount={(docs?.length ?? 0) + sprint.docs.length} />
          ) : (
            <>
              <ReturnedTasks
                tasks={returned}
                sprint={sprint}
                members={members}
                memberMap={memberMap}
                load={load}
                isLead={lead}
                leaderName={leaderName}
                flagged={flagged}
                onShowSource={showSource}
              />
              {previous && (
                <PrevSprintReview
                  previous={previous}
                  previousTasks={ctx.allTasks.filter((t) => t.sprintId === previous.id && t.state !== 'DEFERRED')}
                  carryTasks={carryTasks}
                  dependencies={dependencies.filter((d) => d.scope === 'prev')}
                  hasPlanTasks={all.length > 0}
                  memberMap={memberMap}
                  taskMap={taskMap}
                  isLead={lead}
                />
              )}
              <CapacityStrip
                sprint={sprint}
                members={members}
                load={load}
                flagged={flagged}
                isLead={lead}
                need={sum(Object.values(load))}
                carryPoints={sum(carryTasks.filter((t) => t.carry).map(carrySP))}
                suggestions={suggestions}
                onDeferSuggested={() => deferSuggested.mutate(sprint.id)}
                onRebalance={() => rebalance.mutate(sprint.id)}
                busy={deferSuggested.isPending || rebalance.isPending}
              />

              <SegmentedControl<'tasks' | 'deps'>
                size="sm"
                aria-label="檢視"
                className="mb-4"
                value={view}
                onChange={setView}
                options={[
                  { value: 'tasks', label: '任務' },
                  { value: 'deps', label: `依賴與平行（${dependencies.length}）` },
                ]}
              />
              {view === 'deps' ? (
                <DependencyPanel tasks={all} dependencies={dependencies} taskMap={taskMap} memberMap={memberMap} isLead={lead} />
              ) : workTasks.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="還沒有任務"
                  description={
                    !sprint.questions
                      ? '先在左側按「AI 分析會議紀錄」，也可以按右上角「＋ 新增任務」手動建立'
                      : sprint.questions.some((q) => !q.answer)
                        ? '請先回答左側的待釐清問題'
                        : '按「回答完成，開始 AI 拆解」產生任務'
                  }
                />
              ) : (
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
                                <DraftTaskCard
                                  key={t.id}
                                  task={t}
                                  sprint={sprint}
                                  members={members}
                                  memberMap={memberMap}
                                  load={load}
                                  isLead={lead}
                                  leaderName={leaderName}
                                  flagged={flagged}
                                  onShowSource={showSource}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
              <DeferredList tasks={deferredTasks} isLead={lead} />
            </>
          )}

          {all.length > 0 && !analyzing && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
              <span className="text-xs tabular-nums text-gray-500">
                待確認 {count(['PENDING_MEMBER'])} · 退回 {count(['RETURNED'])} · 已接受 {count(['ASSIGNED'])} · 草稿 {drafts.length}
              </span>
              {drafts.length ? (
                <Button variant="primary" disabled={!lead} onClick={check.open}>
                  <Send className="h-4 w-4" strokeWidth={1.75} />
                  核准並發送指派邀請（{drafts.length}）
                </Button>
              ) : ctx.planningReady ? (
                <Button
                  variant="primary"
                  disabled={me.role !== 'Leader'}
                  title={me.role === 'Leader' ? undefined : '只有 Leader 可以啟動 Sprint'}
                  loading={startSprint.isPending}
                  onClick={() => startSprint.mutate(sprint.id)}
                >
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                  Start {sprint.name}
                </Button>
              ) : (
                <Badge tone="orange" dot>
                  等待成員接受或處理協商退回
                </Badge>
              )}
            </div>
          )}
        </Card>
      </div>

      <ManualTaskDialog
        open={manual.isOpen}
        onClose={manual.close}
        initialSource={manualSource}
        sprint={sprint}
        members={members}
        load={load}
        defaultPolicy={ctx.project?.defaultPolicy ?? FALLBACK_POLICY}
        leaderName={leaderName}
      />
      <PreflightDialog
        open={check.isOpen}
        onClose={check.close}
        result={result}
        capacity={capTotal(sprint, members)}
        taskMap={taskMap}
        onBack={back}
        approving={approveDrafts.isPending}
        onApprove={() =>
          approveDrafts.mutate(undefined, {
            onSuccess: () => {
              setFlagged(false);
              check.close();
            },
          })
        }
      />
    </>
  );
}
