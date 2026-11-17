import { ArrowRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardHeader } from '@/components/ui';
import { sum } from '@/lib/format';
import type { Member } from '@/types';
import { StickyWorkspace } from '../components/StickyWorkspace';
import { StoryCard } from '../components/StoryCard';
import { StoryInsightPanel } from '../components/StoryInsightPanel';
import { TeamCapacityBar } from '../components/TeamCapacityBar';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';

/**
 * 階段 A：Story 結構化分析與確認。
 * 上方 Team Capacity 隨頁面自然捲動；下方雙欄與操作列為吸頂的固定視窗高度工作區，
 * 左側 Story 清單、右側 AI 拆解依據各自內部捲動。
 */
export function StoryReviewStep({ members }: { members: Member[] }) {
  const { draft, selectedStoryId, selectStory, updateStory, addStory, setStage } = usePlanningStore();
  const { generateTasks } = usePlanningMutations();
  const [newStoryId, setNewStoryId] = useState<string | null>(null);
  if (!draft) return null;

  const { stories, tasks } = draft;
  const selected = stories.find((s) => s.id === selectedStoryId);
  const totalSp = sum(stories.map((s) => s.storyPoints));

  // 只替尚未拆解的 Story 產生 Task；全部都已拆解時直接進入階段 B
  const confirmStories = () => {
    const pending = stories.filter((s) => !tasks.some((t) => t.storyId === s.id));
    if (!pending.length) return setStage('tasks');
    generateTasks.mutate({ sprintId: draft.sprintId, stories: pending, existingTaskCount: tasks.length });
  };

  return (
    <div>
      <TeamCapacityBar members={members} tasks={tasks} phase="stories" storyPoints={totalSp} className="mb-5" />

      <StickyWorkspace label="Story 審核工作區">
        <div className="grid gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)]">
          <Card className="flex flex-col lg:col-span-7 lg:h-full lg:min-h-0 lg:overflow-hidden">
            <CardHeader
              className="shrink-0"
              title="Story 切分"
              description={`${stories.length} 個 Story · 預估 ${totalSp} SP`}
              action={
                <Button size="sm" onClick={() => setNewStoryId(addStory())}>
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  手動新增 Story
                </Button>
              }
            />
            <div className="scrollbar-thin -mx-2 space-y-3 px-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-label="Story 清單">
              {stories.map((s) => (
                <StoryCard
                  key={s.id}
                  story={s}
                  selected={s.id === selectedStoryId}
                  defaultEditing={s.id === newStoryId}
                  onSelect={() => selectStory(s.id)}
                  onChange={(patch) => updateStory(s.id, patch)}
                />
              ))}
            </div>
          </Card>

          <StoryInsightPanel story={selected} className="lg:col-span-5" />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-card">
          <p className="text-sm text-gray-500">確認 Story 切分後，AI 會依每個 Story 拆解出可派工的 Task，全部先放入未指派。</p>
          <Button variant="primary" loading={generateTasks.isPending} onClick={confirmStories}>
            {generateTasks.isPending ? 'AI 拆解 Task 中' : '確認 Story 並進入 Task 拆解'}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      </StickyWorkspace>
    </div>
  );
}
