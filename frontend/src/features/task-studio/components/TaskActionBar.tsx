import { Check, GitPullRequest, Play, Zap } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Input } from '@/components/ui';
import { NegotiateDialog } from '@/components/domain/NegotiateDialog';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useTaskActions } from '@/hooks/useTaskActions';
import { REVIEW_POLICIES } from '@/lib/constants';
import { mention } from '@/lib/format';
import { canClaim, canReview } from '@/lib/permissions';
import type { Member, Task } from '@/types';

const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-sm text-gray-500">{children}</span>;

/** 依任務狀態與目前身分顯示可執行的操作 */
export function TaskActionBar({ task, userId, members }: { task: Task; userId: string; members: Map<string, Member> }) {
  const actions = useTaskActions();
  const negotiate = useDisclosure();
  const [note, setNote] = useState('');
  const owner = task.assigneeId === userId;
  const name = (id: string | null) => mention(members.get(id ?? '')?.name);
  const p = task.policy;

  let content: React.ReactNode = null;
  switch (task.state) {
    case 'PENDING_MEMBER':
      content = owner ? (
        <>
          <Button variant="primary" loading={actions.accept.isPending} onClick={() => actions.accept.mutate(task.id)}>
            <Check className="h-4 w-4" strokeWidth={2} />
            接受 Accept
          </Button>
          <Button onClick={negotiate.open}>協商轉移 / 拒絕</Button>
        </>
      ) : (
        <Hint>等待 {name(task.assigneeId)} 確認</Hint>
      );
      break;
    case 'AI_DRAFT':
    case 'DRAFT':
      content = <Hint>草稿：Leader 核准後才會發送指派邀請</Hint>;
      break;
    case 'RETURNED':
      content = <Hint>已退回 Leader 重新指派</Hint>;
      break;
    case 'ASSIGNED':
      content = <Hint>已接受，等待 Leader 啟動 Sprint</Hint>;
      break;
    case 'TODO':
      content = owner ? (
        <Button variant="primary" loading={actions.startDev.isPending} onClick={() => actions.startDev.mutate(task.id)}>
          <Play className="h-4 w-4" strokeWidth={1.75} />
          開始開發
        </Button>
      ) : (
        <Hint>只有 {name(task.assigneeId)} 可以開始（可切換身分）</Hint>
      );
      break;
    case 'IN_PROGRESS':
      content = owner ? (
        <>
          <Button variant="primary" loading={actions.submitReview.isPending} onClick={() => actions.submitReview.mutate(task.id)}>
            <GitPullRequest className="h-4 w-4" strokeWidth={1.75} />
            發布 PR 並送審
          </Button>
          <Hint>將套用：{REVIEW_POLICIES[p.mode].label}</Hint>
        </>
      ) : (
        <Hint>{name(task.assigneeId)} 開發中</Hint>
      );
      break;
    case 'IN_REVIEW':
      if (canClaim(task, userId)) {
        content = (
          <Button variant="primary" loading={actions.claim.isPending} onClick={() => actions.claim.mutate(task.id)}>
            <Zap className="h-4 w-4" strokeWidth={1.75} />
            Claim Review
          </Button>
        );
      } else if (canReview(task, userId)) {
        content = (
          <>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="審查意見（要求修改時必填）"
              aria-label="審查意見"
              className="min-w-[200px] flex-1 rounded-full"
            />
            <Button variant="primary" loading={actions.approve.isPending} onClick={() => actions.approve.mutate(task.id)}>
              <Check className="h-4 w-4" strokeWidth={2} />
              核准
            </Button>
            <Button
              loading={actions.requestChanges.isPending}
              onClick={() => actions.requestChanges.mutate({ id: task.id, note }, { onSuccess: () => setNote('') })}
            >
              要求修改
            </Button>
          </>
        );
      } else {
        const waiting =
          p.mode === 'pool' && !task.reviewerId
            ? '開放認領中（負責人不能審查自己的任務）'
            : `等待 ${p.mode === 'target' ? p.targets.filter((x) => !task.approvals.includes(x)).map(name).join('、') : name(task.reviewerId)} 審查`;
        content = <Hint>{waiting}</Hint>;
      }
      break;
    case 'DONE':
      content = <Badge tone="sky" dot>已通過審查</Badge>;
      break;
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      {content}
      <NegotiateDialog task={task} open={negotiate.isOpen} onClose={negotiate.close} />
    </Card>
  );
}
