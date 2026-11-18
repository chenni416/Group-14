import { Check, Eye, Flag, Undo2, Zap, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button } from '@/components/ui';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { cn } from '@/lib/cn';
import { mention, relativeTime } from '@/lib/format';
import { carrySP } from '@/lib/planning';
import type { Member, Notification, NotificationType, Task } from '@/types';

const ICONS: Record<NotificationType, { icon: LucideIcon; className: string }> = {
  invite: { icon: Flag, className: 'bg-orange-50 text-orange-600' },
  review: { icon: Eye, className: 'bg-violet-50 text-violet-600' },
  pool: { icon: Zap, className: 'bg-sky-50 text-sky-600' },
  returned: { icon: Undo2, className: 'bg-red-50 text-red-600' },
  info: { icon: Check, className: 'bg-gray-100 text-gray-600' },
};

interface Props {
  notification: Notification;
  task: Task;
  members: Map<string, Member>;
  onNegotiate: (task: Task) => void;
}

export function NotificationItem({ notification: n, task, members, onNegotiate }: Props) {
  const navigate = useNavigate();
  const drawer = useTaskDrawer();
  const { accept, claim } = useTaskActions();
  const pending = n.status === 'pending';
  const from = mention(members.get(n.fromId)?.name);
  const ref = (
    <span className="font-medium text-gray-900">
      {task.id}: {task.title}
    </span>
  );

  let head: React.ReactNode;
  let actions: React.ReactNode = null;
  switch (n.type) {
    case 'invite':
      // 上輪未完成任務的帶入／延後決定
      if (task.carryStatus != null && task.carry != null) {
        head = task.carry ? (
          <>
            {from} 將上輪的 {ref} 帶入下個 Sprint 交給您，評估本輪需要 <span className="tabular-nums">{carrySP(task)}</span> SP 完成
          </>
        ) : (
          <>{from} 決定將上輪的 {ref} 延後到之後的 Sprint</>
        );
        if (pending && task.carryStatus === 'pending')
          actions = (
            <>
              <Button variant="primary" size="sm" loading={accept.isPending} onClick={() => accept.mutate(task.id)}>
                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                {task.carry ? '接受帶入' : '確認延後'}
              </Button>
              <Button size="sm" onClick={() => onNegotiate(task)}>
                協商退回
              </Button>
            </>
          );
        break;
      }
      head = <>{from} 已指派 {ref} 給您，預估 <span className="tabular-nums">{task.storyPoints}</span> 點</>;
      if (pending && task.state === 'PENDING_MEMBER')
        actions = (
          <>
            <Button variant="primary" size="sm" loading={accept.isPending} onClick={() => accept.mutate(task.id)}>
              <Check className="h-3.5 w-3.5" strokeWidth={2} />
              接受 Accept
            </Button>
            <Button size="sm" onClick={() => onNegotiate(task)}>
              協商轉移 / 拒絕
            </Button>
            <Button variant="ghost" size="sm" onClick={() => drawer.open(task.id)}>
              查看
            </Button>
          </>
        );
      break;
    case 'review':
      head = <>{from} 請你審查 {ref}</>;
      if (pending)
        actions = (
          <Button variant="primary" size="sm" onClick={() => drawer.open(task.id)}>
            開啟審查
          </Button>
        );
      break;
    case 'pool':
      head = <>Review 公共池：{ref}</>;
      if (pending && !task.reviewerId && task.state === 'IN_REVIEW')
        actions = (
          <>
            <Button variant="primary" size="sm" loading={claim.isPending} onClick={() => claim.mutate(task.id)}>
              <Zap className="h-3.5 w-3.5" strokeWidth={1.75} />
              Claim Review
            </Button>
            <Button variant="ghost" size="sm" onClick={() => drawer.open(task.id)}>
              查看
            </Button>
          </>
        );
      break;
    case 'returned':
      head = <>{from} 對 {ref} 提出協商</>;
      if (pending && (task.state === 'RETURNED' || task.carryStatus === 'returned'))
        actions = (
          <Button variant="primary" size="sm" onClick={() => navigate('/sprints/planning')}>
            前往重新指派
          </Button>
        );
      break;
    default:
      head = <>{from} · {ref}</>;
  }

  const { icon: Icon, className } = ICONS[n.type];
  return (
    <article className={cn('flex gap-4 rounded-2xl border border-gray-100 bg-white p-4', !pending && 'bg-gray-50/60')}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', className)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1 text-sm text-gray-600">
        <div>{head}</div>
        <div className="mt-1 text-xs text-gray-500">
          {n.text} · {relativeTime(n.createdAt)}
        </div>
        {actions ? (
          <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
        ) : (
          !pending && <Badge className="mt-2">已處理</Badge>
        )}
      </div>
    </article>
  );
}
