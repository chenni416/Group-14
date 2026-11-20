import { ArrowRight, ClipboardCheck, Clock, Plus, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Button, Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { branchName, loadByMember } from '@/lib/planning';
import type { Member } from '@/types';
import { StickyWorkspace } from '../components/StickyWorkspace';
import { DependencyChips } from '../components/DependencyChips';
import { TaskDraftCard } from '../components/TaskDraftCard';
import { TaskInsightPanel, type NextStoryHint } from '../components/TaskInsightPanel';
import { TeamCapacityBar } from '../components/TeamCapacityBar';
import { useAssignDraftTask } from '../hooks/useAssignDraftTask';
import { usePlanningStore } from '../store';

/**
 * 階段 B：單一 Story 深入拆解 Task 與派工。
 * 上方 Team Capacity 隨頁面自然捲動；下方 Story 切換、Task 清單、AI 分析與操作列為吸頂的固定視窗高度工作區。
 * 一次聚焦一個 Story；全部指派後進入階段 C 檢視最終派工總覽。
 */
export function TaskBreakdownStep({ members }: { members: Member[] }) {
  const {
    draft,
    activeStoryId,
    selectedTaskId,
    collapsedTaskIds,
    scrollTarget,
    setActiveStory,
    setStage,
    selectTask,
    updateTask,
    addTask,
    removeTask,
    toggleTaskCollapsed,
    jumpToNextUnassigned,
    clearScrollTarget,
    requestDefer,
    requestRestore,
  } = usePlanningStore();
  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const assign = useAssignDraftTask(members);
  const listRef = useRef<HTMLDivElement>(null);
  const story = draft?.stories.find((s) => s.id === activeStoryId) ?? draft?.stories[0];

  // 切換 Story 時清單回到頂端
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [story?.id]);

  // 程式跳轉（套用建議、跳至下一個未指派）時，把目標卡片捲到清單頂端
  useEffect(() => {
    const list = listRef.current;
    if (!scrollTarget || !list) return;
    const card = list.querySelector<HTMLElement>(`[data-task-id="${scrollTarget}"]`);
    if (card) {
      if (list.scrollHeight > list.clientHeight) {
        list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - 4;
      } else {
        card.scrollIntoView({ block: 'nearest' });
      }
    }
    clearScrollTarget();
  }, [scrollTarget, clearScrollTarget]);

  if (!draft) return null;
  const { stories, tasks } = draft;
  const storyTasks = tasks.filter((t) => t.storyId === story?.id);
  const selected = tasks.find((t) => t.id === selectedTaskId && t.storyId === story?.id) ?? storyTasks[0];
  const load = loadByMember(members, tasks);
  // 延後的任務留在清單中標註，但不算在指派進度
  const active = tasks.filter((t) => !t.deferred);
  const assigned = active.filter((t) => t.assigneeId).length;
  const allAssigned = active.length > 0 && assigned === active.length;
  const remainingInStory = storyTasks.filter((t) => !t.deferred && !t.assigneeId && t.id !== selected?.id).length;

  // 目前 Story 完成後建議前往的下一個 Story：依序往後找第一個還有未指派 Task 的 Story
  const storyIdx = stories.findIndex((s) => s.id === story?.id);
  const nextStory: NextStoryHint | null =
    stories
      .slice(storyIdx + 1)
      .concat(stories.slice(0, storyIdx))
      .map((s) => ({ story: s, unassigned: active.filter((t) => t.storyId === s.id && !t.assigneeId).length }))
      .find((h) => h.unassigned > 0) ?? null;

  return (
    <>
      <TeamCapacityBar
        members={members}
        tasks={tasks}
        onAssign={assign}
        onTaskClick={(t) => {
          setActiveStory(t.storyId);
          selectTask(t.id);
        }}
        className="mb-5"
      />

      <StickyWorkspace label="Task 派工工作區">
        {/* 單一 Story 聚焦切換器 */}
        <div className="flex shrink-0 gap-2 overflow-x-auto pb-1" role="tablist" aria-label="切換 Story">
          {stories.map((s) => {
            const list = active.filter((t) => t.storyId === s.id);
            const done = list.filter((t) => t.assigneeId).length;
            const current = s.id === story?.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={current}
                onClick={() => setActiveStory(s.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border py-2 pl-3 pr-2 text-sm transition-colors duration-150',
                  current ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                  s.deferred && !current && 'border-dashed text-gray-400',
                )}
              >
                <span className={cn('font-mono text-xs', active ? 'text-gray-300' : 'text-gray-500')}>{s.code}</span>
                <span className="max-w-[220px] truncate font-medium">{s.title}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs tabular-nums',
                    current
                      ? 'bg-white/15 text-white'
                      : s.deferred || (done === list.length && list.length)
                        ? 'bg-gray-100 text-gray-700'
                        : 'bg-orange-50 text-orange-700',
                  )}
                >
                  {s.deferred ? '已延後' : `${done}/${list.length}`}
                </span>
              </button>
            );
          })}
        </div>

        {story && (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="min-w-0 flex-1 truncate text-sm text-gray-500" title={story.userStory}>
              <span className="font-medium text-gray-900">{story.title}</span> · {story.userStory}
            </p>
            <DependencyChips itemId={story.id} />
            {story.deferred ? (
              <Button size="xs" onClick={() => requestRestore('story', story.id)}>
                <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                取消延後此 Story
              </Button>
            ) : (
              <Button size="xs" variant="ghost" title="Story 與底下所有 Task 延後到之後的 Sprint" onClick={() => requestDefer('story', story.id)}>
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                延後此 Story
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <div ref={listRef} className="scrollbar-thin space-y-3 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1" aria-label="Task 清單">
            {storyTasks.length ? (
              storyTasks.map((t) => (
                <TaskDraftCard
                  key={t.id}
                  task={t}
                  branch={branchName(t)}
                  members={members}
                  load={load}
                  selected={t.id === selected?.id}
                  collapsed={collapsedTaskIds.includes(t.id)}
                  onToggle={() => toggleTaskCollapsed(t.id)}
                  onSelect={() => selectTask(t.id)}
                  onChange={(patch) => updateTask(t.id, patch)}
                  onAssign={(memberId) => assign(t.id, memberId)}
                  onRemove={() => removeTask(t.id)}
                />
              ))
            ) : (
              <Card>
                <EmptyState icon={ClipboardCheck} title="這個 Story 還沒有 Task" description="新增 Task 後再進行指派" />
              </Card>
            )}
            {story && !story.deferred && (
              <Button className="w-full border-dashed" onClick={() => addTask(story.id)}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                新增 Task
              </Button>
            )}
          </div>

          <TaskInsightPanel
            task={selected}
            members={memberMap}
            load={load}
            onApplySuggestion={(t) => t.suggestedAssigneeId && assign(t.id, t.suggestedAssigneeId)}
            remainingInStory={remainingInStory}
            onJumpNext={jumpToNextUnassigned}
            nextStory={nextStory}
            onGoToStory={setActiveStory}
            allAssigned={allAssigned}
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-sm tabular-nums text-gray-500">
            已指派 <span className="font-semibold text-gray-900">{assigned}</span> / {active.length} 張 Task · 共{' '}
            {sum(active.map((t) => t.storyPoints))} SP
            {!allAssigned && <span className="text-orange-700">，全部指派後即可檢視最終派工總覽</span>}
          </p>
          <Button variant="primary" disabled={!allAssigned} onClick={() => setStage('review')}>
            檢視最終派工總覽
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </StickyWorkspace>
    </>
  );
}
