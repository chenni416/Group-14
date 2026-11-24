import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { InviteMemberInput, Member, UpdateMemberInput } from '@/types';

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
  return { invite, update, remove };
}
