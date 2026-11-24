import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { UpdateMeInput } from '@/types';
import { useApiMutation } from './useApiMutation';

/** 修改自己的顯示名稱（GitHub 登入模式） */
export function useUpdateMe() {
  return useApiMutation({
    mutationFn: (input: UpdateMeInput) => api.auth.updateMe(input),
    invalidate: [['me'], ['members']],
    onSuccess: (member) => toast(member.displayName ? `顯示名稱已改為 ${member.name}` : '已恢復使用 GitHub 帳號名稱'),
  });
}
