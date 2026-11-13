import { GitPullRequest, TerminalSquare } from 'lucide-react';
import { Avatar, Tag } from '@/components/ui';
import { DOMAINS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { Member, Task } from '@/types';
import { useCopyPrompt } from '@/features/task-studio/hooks/useCopyPrompt';
import { ReviewIndicator } from './ReviewIndicator';

interface Props {
  task: Task;
  members: Map<string, Member>;
  leaderId: string | undefined;
  userId: string;
  onOpen: (id: string) => void;
}

export function TaskCard({ task, members, leaderId, userId, onOpen }: Props) {
  const copyPrompt = useCopyPrompt();
  const awaitingLeader = task.state === 'IN_REVIEW' && task.policy.mode === 'leader';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(task.id)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(task.id))}
      className={cn(
        'cursor-pointer rounded-2xl border bg-white p-4 transition-colors duration-150 hover:border-gray-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
        awaitingLeader ? 'border-orange-200' : 'border-gray-100',
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
    </div>
  );
}
