import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { Callout, Card, CardHeader, EmptyState, PageHeader, PageSkeleton, ProgressBar, SegmentedControl } from '@/components/ui';
import { NegotiateDialog } from '@/components/domain/NegotiateDialog';
import { StateFlow } from '@/components/domain/StateFlow';
import { useCurrentUser, useMemberMap, useNotifications, useSprintContext } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { capOf, carryOwner, carrySP } from '@/lib/planning';
import { useUiStore, type InboxFilter } from '@/stores/ui.store';
import type { Task } from '@/types';
import { NotificationItem } from './components/NotificationItem';

const FILTERS = [
  { value: 'all' as const, label: '全部' },
  { value: 'invite' as const, label: '指派邀請' },
  { value: 'review' as const, label: 'Review' },
  { value: 'returned' as const, label: '協商退回' },
];

export function InboxPage() {
  const { data: me } = useCurrentUser();
  const { data: notifications, isLoading } = useNotifications();
  const ctx = useSprintContext();
  const members = useMemberMap();
  const { inboxFilter, setInboxFilter } = useUiStore();
  const [negotiating, setNegotiating] = useState<Task | null>(null);

  if (isLoading || ctx.isLoading || !me) return <PageSkeleton />;

  const taskMap = new Map(ctx.allTasks.map((t) => [t.id, t]));
  const list = (notifications ?? []).filter(
    (n) => inboxFilter === 'all' || n.type === inboxFilter || (inboxFilter === 'review' && n.type === 'pool'),
  );
  const mine = ctx.planningTasks.filter((t) => t.assigneeId === me.id);
  // 上輪帶入給我的任務（以本輪預估點數計）：確認後算已接受，其餘算待確認
  const myCarry = ctx.carryTasks.filter((t) => t.carry === true && carryOwner(t) === me.id);
  const carryAccepted = sum(myCarry.filter((t) => t.carryStatus === 'accepted').map(carrySP));
  const carryPending = sum(myCarry.filter((t) => t.carryStatus !== 'accepted').map(carrySP));
  const accepted = sum(mine.filter((t) => t.state === 'ASSIGNED').map((t) => t.storyPoints)) + carryAccepted;
  const pending = sum(mine.filter((t) => t.state === 'PENDING_MEMBER').map((t) => t.storyPoints)) + carryPending;
  const cap = capOf(ctx.planning, me);

  return (
    <>
      <PageHeader
        eyebrow="Action Required Inbox"
        title="確認與認領"
        actions={<SegmentedControl<InboxFilter> options={FILTERS} value={inboxFilter} onChange={setInboxFilter} aria-label="通知類型" />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          {list.length ? (
            list.map((n) => {
              const task = taskMap.get(n.taskId);
              return task ? (
                <NotificationItem key={n.id} notification={n} task={task} members={members} onNegotiate={setNegotiating} />
              ) : null;
            })
          ) : (
            <Card>
              <EmptyState icon={Inbox} title="沒有待處理的項目" description="試試從右上角切換成其他成員" />
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={`我的 ${ctx.planning?.name ?? 'Sprint'} 承接量`} />
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="text-gray-500 tabular-nums">
                已接受 {accepted} SP · 待確認 {pending} SP
              </span>
              <span className={cn('font-semibold tabular-nums', accepted + pending > cap && 'text-red-600')}>
                {accepted + pending} / {cap}
              </span>
            </div>
            <ProgressBar
              max={cap}
              size="lg"
              segments={[
                { value: accepted, tone: 'sky', label: '已接受' },
                { value: pending, tone: 'orange', label: '待確認' },
              ]}
              label="承接量"
            />
            {myCarry.length > 0 && (
              <p className="mt-2 text-xs tabular-nums text-gray-500">
                含上輪帶入 {myCarry.length} 項 · {carryAccepted + carryPending} SP
              </p>
            )}
            <Callout className="mt-4">
              雙向確認：Leader 核准後任務只是「邀請」，必須由你接受才會鎖定；時間不足可以協商，任務會退回 Leader 重新指派。
            </Callout>
          </Card>
          <Card>
            <CardHeader title="狀態流程" />
            <StateFlow />
          </Card>
        </div>
      </div>
      <NegotiateDialog task={negotiating} open={!!negotiating} onClose={() => setNegotiating(null)} />
    </>
  );
}
