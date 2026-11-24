import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { CreateInvitationInput, Invitation, InviteMemberInput, Member, UpdateMemberInput } from '@/types';

export function useTeamMutations() {
  const invite = useApiMutation({
    mutationFn: (input: InviteMemberInput) => api.members.invite(input),
    invalidate: [['members']],
    onSuccess: () => toast('已送出邀請'),
  });
  const update = useApiMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMemberInput }) => api.members.update(id, patch),
    invalidate: [['members'], ['me']],
  });
  const remove = useApiMutation({
    mutationFn: (member: Member) => api.members.remove(member.id),
    invalidate: [['members'], ['org']],
    onSuccess: (_, member) => toast(`已將 ${member.name} 移出專案`),
  });
  // 用 GitHub 帳號邀請：對方登入後在「加入專案」頁接受
  const createInvitation = useApiMutation({
    mutationFn: (input: CreateInvitationInput) => api.invitations.create(input),
    invalidate: [['invitations']],
    onSuccess: (inv) => toast(`已邀請 @${inv.githubLogin}，對方登入後在「加入專案」頁接受`),
  });
  const revokeInvitation = useApiMutation({
    mutationFn: (inv: Invitation) => api.invitations.revoke(inv.id),
    invalidate: [['invitations']],
    onSuccess: (_, inv) => toast(`已撤銷對 @${inv.githubLogin} 的邀請`),
  });
  return { invite, update, remove, createInvitation, revokeInvitation };
}
