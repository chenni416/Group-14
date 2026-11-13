import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';

/** 切換示範身分後重新抓取所有資料 */
export function useSwitchUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.auth.switchUser,
    onSuccess: async (member) => {
      await qc.invalidateQueries();
      toast(`已切換為 ${member.name}（${member.role}）`);
    },
  });
}
