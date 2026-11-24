import { Button, Card, CardHeader } from '@/components/ui';
import { useJoinRequests } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { JoinRequest } from '@/types';

/** Leader 審核用邀請碼送出的加入申請；沒有待審核的申請時不顯示 */
export function JoinRequests() {
  const { data } = useJoinRequests();
  const approve = useApiMutation({
    mutationFn: (r: JoinRequest) => api.joinCodes.approve(r.id),
    invalidate: [['join-requests'], ['members']],
    onSuccess: (_, r) => toast(`已同意 ${r.memberName} 加入`),
  });
  const reject = useApiMutation({
    mutationFn: (r: JoinRequest) => api.joinCodes.reject(r.id),
    invalidate: [['join-requests']],
    onSuccess: (_, r) => toast(`已拒絕 ${r.memberName} 的申請`),
  });
  const requests = data ?? [];
  if (requests.length === 0) return null;
  const busy = approve.isPending || reject.isPending;

  return (
    <Card>
      <CardHeader title="待審核的加入申請" description="用邀請碼送出的申請，同意後才會加入專案" />
      <div className="divide-y divide-gray-100">
        {requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <img
                src={r.avatarUrl || `https://github.com/${encodeURIComponent(r.githubLogin)}.png?size=64`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-gray-100"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">{r.memberName}</span>
                <span className="block truncate text-xs text-gray-500">@{r.githubLogin}</span>
              </span>
            </span>
            <span className="flex gap-2">
              <Button size="xs" variant="primary" disabled={busy} onClick={() => approve.mutate(r)}>
                同意
              </Button>
              <Button size="xs" disabled={busy} onClick={() => reject.mutate(r)}>
                拒絕
              </Button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
