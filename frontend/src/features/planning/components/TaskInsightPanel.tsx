import { ArrowRight, CircleCheck, Sparkles } from 'lucide-react';
import { Avatar, Badge, Button, Callout, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { reviewerSummary } from '@/lib/planning';
import type { Member, StoryDraft, TaskDraft } from '@/types';

export interface NextStoryHint {
  story: StoryDraft;
  unassigned: number;
}

interface Props {
  task: TaskDraft | undefined;
  members: Map<string, Member>;
  load: Record<string, number>;
  onApplySuggestion: (task: TaskDraft) => void;
  /** 目前 Story 中、除了這張以外的未指派數 */
  remainingInStory: number;
  onJumpNext: () => void;
  /** 目前 Story 全部指派完成時，建議前往的下一個 Story */
  nextStory: NextStoryHint | null;
  onGoToStory: (storyId: string) => void;
  allAssigned: boolean;
  className?: string;
}

/** 目前 Story 已全部指派時的完成提示 */
function StoryDoneNotice({ nextStory, allAssigned, onGoToStory }: Pick<Props, 'nextStory' | 'allAssigned' | 'onGoToStory'>) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <CircleCheck className="h-4 w-4 text-sky-600" strokeWidth={1.75} />
        此 Story 的 Task 已全部指派
      </div>
      {nextStory ? (
        <Button size="sm" className="mt-3" onClick={() => onGoToStory(nextStory.story.id)}>
          前往 {nextStory.story.code} {nextStory.story.title}（{nextStory.unassigned} 項未指派）
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
        </Button>
      ) : (
        allAssigned && <p className="mt-1.5 text-sm text-gray-500">所有 Task 都已指派完成，可以檢視最終派工總覽。</p>
      )}
    </div>
  );
}

function LoadLine({ member, before, after }: { member: Member; before: number; after: number }) {
  const over = after > member.capacity;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <Avatar member={member} size="xs" />
        {member.name}
      </span>
      <span className="tabular-nums text-gray-500">
        {before} → <span className={over ? 'font-semibold text-red-600' : 'font-semibold text-gray-900'}>{after}</span> / {member.capacity} SP
      </span>
    </div>
  );
}

/** 階段 B 右側：當前 Task 的技術分析、推薦理由與指派決策 */
export function TaskInsightPanel({
  task,
  members,
  load,
  onApplySuggestion,
  remainingInStory,
  onJumpNext,
  nextStory,
  onGoToStory,
  allAssigned,
  className,
}: Props) {
  if (!task) {
    return (
      <Card className={cn('p-5 lg:h-full', className)}>
        <p className="text-sm text-gray-500">點選左側 Task 卡片，查看 AI 分析與指派建議。</p>
      </Card>
    );
  }

  const suggested = task.suggestedAssigneeId ? members.get(task.suggestedAssigneeId) : undefined;
  const assignee = task.assigneeId ? members.get(task.assigneeId) : undefined;
  const differs = !!suggested && task.assigneeId !== suggested.id;
  // 若改套用建議人選，計算其負載變化
  const suggestedBefore = suggested ? load[suggested.id] ?? 0 : 0;

  return (
    <Card className={cn('scrollbar-thin space-y-5 p-5 lg:h-full lg:overflow-y-auto', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-gray-500">{task.code}</div>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{task.title}</h2>
        </div>
        <Badge tone="violet">
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          AI 分析
        </Badge>
      </div>

      {task.assigneeId && remainingInStory === 0 && (
        <StoryDoneNotice nextStory={nextStory} allAssigned={allAssigned} onGoToStory={onGoToStory} />
      )}

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-gray-500">技術分析</h3>
        <p className="text-sm leading-relaxed text-gray-700">{task.analysis}</p>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-gray-500">推薦指派</h3>
        <Callout tone="ai" title={suggested ? `建議指派 ${suggested.name}` : '沒有 AI 建議'}>
          {task.assignReason}
        </Callout>
        {(differs || remainingInStory > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {differs && (
              <Button size="sm" variant="primary" onClick={() => onApplySuggestion(task)}>
                套用建議：指派給 {suggested.name}
              </Button>
            )}
            {remainingInStory > 0 && (
              <Button size="sm" onClick={onJumpNext} title="跳至下一個未指派任務">
                剩餘 {remainingInStory} 項未指派
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium text-gray-500">指派影響</h3>
        <div className="space-y-2 rounded-2xl bg-gray-50 p-3">
          {assignee ? (
            <LoadLine member={assignee} before={(load[assignee.id] ?? 0) - task.storyPoints} after={load[assignee.id] ?? 0} />
          ) : (
            <p className="text-sm text-gray-500">尚未指派負責人</p>
          )}
          {differs && suggested && (
            <LoadLine member={suggested} before={suggestedBefore} after={suggestedBefore + task.storyPoints} />
          )}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-medium text-gray-500">審查安排</h3>
        <p className="text-sm text-gray-700">{reviewerSummary(task.reviewer, members)}</p>
      </section>
    </Card>
  );
}
