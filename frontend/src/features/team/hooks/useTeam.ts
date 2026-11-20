import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { InviteMemberInput, UpdateMemberInput } from '@/types';

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
  return { invite, update };
}
