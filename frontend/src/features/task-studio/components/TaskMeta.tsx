import { Copy, GitPullRequest } from 'lucide-react';
import { Avatar, Card, IconButton } from '@/components/ui';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import type { Member, Task } from '@/types';

export function TaskMeta({ task, assignee }: { task: Task; assignee: Member | undefined }) {
  const copy = useCopyToClipboard();
  return (
    <Card className="grid grid-cols-2 gap-x-6 gap-y-4 p-5">
      <div>
        <div className="mb-1.5 text-xs text-gray-500">Assignee</div>
        <div className="flex items-center gap-2 text-sm">
          <Avatar member={assignee} size="xs" />
          {assignee?.name ?? '—'}
        </div>
      </div>
      <div>
        <div className="mb-1.5 text-xs text-gray-500">Story Points</div>
        <div className="text-sm font-semibold tabular-nums">{task.storyPoints} SP</div>
      </div>
      <div className="col-span-2">
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
          <span>Git Branch</span>
          {task.pr && (
            <span className="inline-flex items-center gap-1">
              <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.75} />
              PR #{task.pr.number} {task.pr.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-700">{task.branch}</span>
          <IconButton aria-label="複製 git 指令" size="sm" variant="ghost" onClick={() => copy(`git checkout -b ${task.branch}`, '已複製 git 指令')}>
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}
