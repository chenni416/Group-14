import { X } from 'lucide-react';
import { Badge, Card, CardHeader, IconButton } from '@/components/ui';
import { useInvitations } from '@/hooks/queries';
import { useTeamMutations } from '../hooks/useTeam';

/** Leader 看到的待接受邀請，可以撤銷；沒有待接受的邀請時不顯示 */
export function PendingInvitations() {
  const { data } = useInvitations();
  const { revokeInvitation } = useTeamMutations();
  const pending = (data ?? []).filter((i) => i.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <Card>
      <CardHeader title="待接受的邀請" description="對方用 GitHub 登入後，會在「加入專案」頁看到邀請" />
      <div className="divide-y divide-gray-100">
        {pending.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="flex min-w-0 items-center gap-3">
              <img
                src={`https://github.com/${encodeURIComponent(inv.githubLogin)}.png?size=64`}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-gray-100"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium text-gray-900">@{inv.githubLogin}</span>
                <span className="block truncate text-xs text-gray-500">
                  {inv.role}
                  {inv.title && ` · ${inv.title}`}
                </span>
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Badge tone="sky" dot>
                等待接受
              </Badge>
              <IconButton
                aria-label={`撤銷對 @${inv.githubLogin} 的邀請`}
                size="sm"
                disabled={revokeInvitation.isPending}
                onClick={() => revokeInvitation.mutate(inv)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </IconButton>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
