import { Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Badge, IconButton, StatusBadge } from '@/components/ui';
import { useCurrentUser, useMemberMap, useMembers, useSprints, useTasks } from '@/hooks/queries';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { AcceptanceCriteria } from './components/AcceptanceCriteria';
import { ChatPanel } from './components/ChatPanel';
import { LivingPrompt } from './components/LivingPrompt';
import { ReviewPolicyForm } from './components/ReviewPolicyForm';
import { TaskActionBar } from './components/TaskActionBar';
import { TaskMeta } from './components/TaskMeta';

/** 任務詳情：左側規格與 Living Prompt，右側專案脈絡對話 */
export function TaskStudioDrawer() {
  const { taskId, close } = useTaskDrawer();
  const { data: tasks } = useTasks();
  const { data: me } = useCurrentUser();
  const { data: memberList } = useMembers();
  const { data: sprints } = useSprints();
  const members = useMemberMap();
  const task = tasks?.find((t) => t.id === taskId);

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

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/30" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${task.id} ${task.title}`}
        data-drawer
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden bg-canvas sm:rounded-l-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-5 sm:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono text-gray-500">{task.id}</span>
              {task.epic && task.epic !== 'Sprint 2' && (
                <span className="text-gray-500">
                  {task.epic} › {task.story}
                </span>
              )}
              <StatusBadge state={task.state} />
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
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <TaskMeta task={task} assignee={members.get(task.assigneeId)} />
              <AcceptanceCriteria task={task} />
              <LivingPrompt taskId={task.id} />
              <ReviewPolicyForm task={task} user={me} members={memberList ?? []} />
              <TaskActionBar task={task} userId={me.id} members={members} />
            </div>
            <div className="lg:sticky lg:top-0 lg:h-[calc(100vh-10rem)]">
              <ChatPanel taskId={task.id} sprint={sprint} />
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
