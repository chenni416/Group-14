import { AlertTriangle, GitPullRequest, TerminalSquare } from 'lucide-react';
import { Avatar, Badge, ProgressBar, Tag } from '@/components/ui';
import { DOMAINS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { checklistProgress, formatDay, nextCheckpoint } from '@/lib/execution';
import type { ExecutionPlan, Member, Task } from '@/types';
import { useCopyPrompt } from '@/features/task-studio/hooks/useCopyPrompt';
import { ReviewIndicator } from './ReviewIndicator';

interface Props {
  task: Task;
  members: Map<string, Member>;
  leaderId: string | undefined;
  userId: string;
  onOpen: (id: string) => void;
  /** G3：這項任務確認過的執行計畫 */
  plan: ExecutionPlan | undefined;
  /** G4：尚未結案的問題數 */
  openIssues: number;
  /** G2：尚未完成的前置任務 */
  waitingOn: Task[];
  /** G3：進度落後 */
  behind: boolean;
  onReport: (taskId: string) => void;
}

const REPORTABLE = ['TODO', 'IN_PROGRESS', 'IN_REVIEW'];

export function TaskCard({ task, members, leaderId, userId, onOpen, plan, openIssues, waitingOn, behind, onReport }: Props) {
  const copyPrompt = useCopyPrompt();
  const awaitingLeader = task.state === 'IN_REVIEW' && task.policy.mode === 'leader';
  const progress = plan?.confirmedAt ? checklistProgress(plan) : null;
  const nextCp = plan?.confirmedAt ? nextCheckpoint(plan) : undefined;
  const blocked = openIssues > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(task.id))}
      className={cn(
        'cursor-pointer rounded-2xl border bg-white p-4 transition-colors duration-150 hover:border-gray-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
        blocked ? 'border-red-200' : awaitingLeader ? 'border-orange-200' : 'border-gray-100',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-gray-500">{task.id}</span>
        <Tag>{DOMAINS[task.domain].label}</Tag>
        <button
          type="button"
          title="複製 Agent Prompt"
          onClick={(e) => {
            e.stopPropagation();
            copyPrompt(task.id);
          }}
          className="ml-auto inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
        >
          <TerminalSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
          Prompt
        </button>
      </div>
      <p className="mt-2.5 text-sm font-medium leading-snug text-gray-900">{task.title}</p>

      {(blocked || waitingOn.length > 0 || behind) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {blocked && (
            <Badge tone="red" dot>
              被阻礙 · {openIssues} 個問題
            </Badge>
          )}
          {waitingOn.length > 0 && <Badge tone="orange">等待 {waitingOn.map((t) => t.id).join('、')}</Badge>}
          {behind && (
            <Badge tone="red" dot>
              進度落後
            </Badge>
          )}
        </div>
      )}

      {progress && progress.total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500">
            <span>Checklist</span>
            <span className="tabular-nums">
              {progress.done}/{progress.total}
            </span>
          </div>
          <ProgressBar value={progress.done} max={progress.total} tone="sky" size="sm" label={`${task.id} Checklist 進度`} />
          {nextCp && (
            <div className="mt-1 text-[11px] tabular-nums text-gray-500">
              下一個：{nextCp.title} · {formatDay(nextCp.dueAt)}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Avatar member={members.get(task.assigneeId)} size="xs" />
        <span className="tabular-nums">{task.storyPoints} SP</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.75} />
          {task.pr ? (
            <span className={task.pr.status === 'merged' ? 'text-sky-700' : ''}>
              #{task.pr.number} {task.pr.status}
            </span>
          ) : (
            'no PR'
          )}
        </span>
      </div>
      {task.state === 'IN_REVIEW' && <ReviewIndicator task={task} members={members} leaderId={leaderId} userId={userId} />}
      {REPORTABLE.includes(task.state) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReport(task.id);
          }}
          className="mt-3 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
        >
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
          回報問題
        </button>
      )}
    </div>
  );
}
