import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Badge, IconButton, SegmentedControl, StatusBadge } from '@/components/ui';
import { useCurrentUser, useMemberMap, useMembers, useSprints, useTasks } from '@/hooks/queries';
import { useExecutionPlans, useIssues } from '@/hooks/useCollab';
import { defaultTab, useTaskDrawer, type DrawerTab } from '@/hooks/useTaskDrawer';
import { cn } from '@/lib/cn';
import { isOpenIssue } from '@/lib/collab';
import type { Task } from '@/types';
import { AcceptanceCriteria } from './components/AcceptanceCriteria';
import { ChatPanel } from './components/ChatPanel';
import { DeliveryTab } from './components/DeliveryTab';
import { ExecutionPlanTab } from './components/ExecutionPlanTab';
import { IssuesTab } from './components/IssuesTab';
import { LivingPrompt } from './components/LivingPrompt';
import { ReviewPolicyForm } from './components/ReviewPolicyForm';
import { TaskActionBar } from './components/TaskActionBar';
import { TaskMeta } from './components/TaskMeta';
import { TaskScope } from './components/TaskScope';

/** 任務詳情：規格、執行計畫、問題與討論、交付與驗收、Prompt 與對話；操作列固定在底部 */
export function TaskStudioDrawer() {
  const { taskId, tab, setTab, close } = useTaskDrawer();
  const { data: tasks } = useTasks();
  const { data: me } = useCurrentUser();
  const { data: memberList = [] } = useMembers();
  const { data: sprints } = useSprints();
  const { data: plans = [] } = useExecutionPlans();
  const { data: issues = [] } = useIssues();
  const members = useMemberMap();
  const task = tasks?.find((t) => t.id === taskId);
  const taskMap = useMemo(() => new Map<string, Task>((tasks ?? []).map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    if (!taskId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-drawer])')) close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [taskId, close]);

  if (!taskId || !task || !me) return null;
  const sprint = sprints?.find((s) => s.id === task.sprintId);
  const plan = plans.find((p) => p.taskId === task.id);
  const openIssues = issues.filter((i) => i.taskId === task.id && isOpenIssue(i)).length;
  // Prompt 與對話只給任務負責人，其他人看不到這個分頁
  const isAssignee = task.assigneeId === me.id;
  const current: DrawerTab = tab && (tab !== 'prompt' || isAssignee) ? tab : defaultTab(task.state);
  const tabs: { value: DrawerTab; label: string }[] = [
    { value: 'spec', label: '規格' },
    { value: 'plan', label: '執行計畫' },
    { value: 'issues', label: openIssues ? `問題與討論（${openIssues}）` : '問題與討論' },
    { value: 'delivery', label: '交付與驗收' },
    ...(isAssignee ? [{ value: 'prompt' as const, label: 'Prompt 與對話' }] : []),
  ];

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/30" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${task.id} ${task.title}`}
        data-drawer
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-canvas sm:rounded-l-3xl"
      >
        <header className="border-b border-gray-100 bg-white px-5 pt-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-gray-500">{task.id}</span>
                {task.epic && task.epic !== 'Sprint 2' && (
                  <span className="text-gray-500">
                    {task.epic} › {task.story}
                  </span>
                )}
                <StatusBadge state={task.state} />
                {openIssues > 0 && (
                  <Badge tone="red" dot>
                    被阻礙
                  </Badge>
                )}
                {task.origin === 'ai' && (
                  <Badge tone="violet">
                    <Sparkles className="h-3 w-3" strokeWidth={2} />
                    AI Generated
                  </Badge>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{task.title}</h2>
            </div>
            <IconButton aria-label="關閉" onClick={close}>
              <X className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </div>
          <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-4">
            <SegmentedControl<DrawerTab> size="sm" aria-label="任務詳情分頁" value={current} onChange={setTab} options={tabs} className="flex-nowrap" />
          </div>
        </header>

        {/* Prompt 與對話在桌機版撐滿到底部操作列 */}
        <div className={cn('flex-1 overflow-y-auto p-4 sm:p-6', current === 'prompt' && 'lg:flex lg:flex-col')}>
          {current === 'spec' && (
            <div className="space-y-6">
              <TaskMeta task={task} assignee={members.get(task.assigneeId)} />
              <TaskScope task={task} me={me} members={members} taskMap={taskMap} />
              <AcceptanceCriteria task={task} />
              <ReviewPolicyForm task={task} user={me} members={memberList} />
            </div>
          )}
          {current === 'plan' && <ExecutionPlanTab task={task} me={me} sprint={sprint} plan={plan} />}
          {current === 'issues' && <IssuesTab task={task} me={me} members={memberList} memberMap={members} />}
          {current === 'delivery' && <DeliveryTab task={task} me={me} memberMap={members} />}
          {current === 'prompt' && (
            <div className="grid gap-6 lg:min-h-[480px] lg:flex-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <LivingPrompt taskId={task.id} />
              {/* 桌機版助理高度跟隨 Living Prompt，對話內容在面板內捲動 */}
              <div className="relative h-[560px] lg:h-auto">
                <div className="absolute inset-0">
                  <ChatPanel taskId={task.id} sprint={sprint} />
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-gray-100 bg-canvas px-4 py-3 sm:px-6">
          <TaskActionBar task={task} userId={me.id} members={members} />
        </footer>
      </section>
    </div>,
    document.body,
  );
}
