import { Clock, Zap } from 'lucide-react';
import { Avatar, AvatarStack } from '@/components/ui';
import { useTaskActions } from '@/hooks/useTaskActions';
import { mention, relativeTime } from '@/lib/format';
import type { Member, Task } from '@/types';

interface Props {
  task: Task;
  members: Map<string, Member>;
  leaderId: string | undefined;
  userId: string;
}

/** In Review 卡片底部的審查狀態列 */
export function ReviewIndicator({ task, members, leaderId, userId }: Props) {
  const { claim } = useTaskActions();
  const { policy } = task;
  const name = (id: string | null | undefined) => mention(members.get(id ?? '')?.name);

  let content;
  if (policy.mode === 'leader') {
    content = (
      <>
        <Clock className="h-3.5 w-3.5 shrink-0 text-accent-orange" strokeWidth={2} />
        <span>
          等待 <span className="font-medium text-gray-900">{name(task.reviewerId ?? leaderId)}</span> 審查
        </span>
      </>
    );
  } else if (policy.mode === 'pool') {
    content = task.reviewerId ? (
      <>
        <Avatar member={members.get(task.reviewerId)} size="xs" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-gray-900">{name(task.reviewerId)}</span> 審查中 · {relativeTime(task.claimedAt)}
        </span>
      </>
    ) : (
      <>
        <button
          type="button"
          disabled={task.assigneeId === userId || claim.isPending}
          onClick={(e) => {
            e.stopPropagation();
            claim.mutate(task.id);
          }}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-neutral-900 px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-neutral-700 disabled:bg-gray-200 disabled:text-gray-500"
        >
          <Zap className="h-3 w-3" strokeWidth={2} />
          Claim Review
        </button>
        <span className="text-gray-500">開放認領 · {relativeTime(task.reviewStartedAt)}</span>
      </>
    );
  } else {
    content = (
      <>
        <AvatarStack
          members={policy.targets.map((id) => members.get(id))}
          fadedIds={policy.targets.filter((id) => !task.approvals.includes(id))}
        />
        <span className="min-w-0 flex-1 truncate">
          <span className="tabular-nums">
            {task.approvals.length}/{policy.targets.length}
          </span>{' '}
          已核准 · {policy.rule === 'all' ? '需全員' : '需 1 人'}
        </span>
      </>
    );
  }

  return <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">{content}</div>;
}
