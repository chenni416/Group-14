import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui';
import { useMyInvitations } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import type { Invitation } from '@/types';

/** 寄給我的邀請（Leader 以我的 GitHub 帳號邀請）：接受後切換到該專案 */
export function ReceivedInvitations() {
  const { data: invitations } = useMyInvitations();
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const accept = useApiMutation({
    mutationFn: (inv: Invitation) => api.invitations.accept(inv.id),
    onSuccess: async ({ projectId }, inv) => {
      setCurrentId(projectId);
      // 加入了新專案：所有資料都要重新讀取
      await qc.invalidateQueries();
      toast(`已加入「${inv.projectName}」`);
      navigate('/');
    },
  });
  const decline = useApiMutation({
    mutationFn: (inv: Invitation) => api.invitations.decline(inv.id),
    invalidate: [['invitations', 'mine']],
    onSuccess: (_, inv) => toast(`已拒絕「${inv.projectName}」的邀請`),
  });

  if (!invitations || invitations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">目前沒有收到邀請</div>
    );
  }

  return (
    <ul className="space-y-3">
      {invitations.map((inv) => (
        <li key={inv.id} className="rounded-2xl bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{inv.projectName}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {inv.invitedByName} 邀請你以 {inv.role}
            {inv.title && `（${inv.title}）`}加入
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="xs"
              variant="primary"
              loading={accept.isPending && accept.variables?.id === inv.id}
              disabled={accept.isPending || decline.isPending}
              onClick={() => accept.mutate(inv)}
            >
              接受
            </Button>
            <Button size="xs" disabled={accept.isPending || decline.isPending} onClick={() => decline.mutate(inv)}>
              拒絕
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
