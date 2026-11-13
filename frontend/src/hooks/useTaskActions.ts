import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { NegotiateInput, ReviewPolicy } from '@/types';
import { useApiMutation } from './useApiMutation';

/** 任務流程相關操作（指派確認、送審、審查） */
export function useTaskActions() {
  const accept = useApiMutation({
    mutationFn: api.tasks.accept,
    onSuccess: (t) => toast(`已接受 ${t.id}`),
  });
  const negotiate = useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: NegotiateInput }) => api.tasks.negotiate(id, input),
    onSuccess: () => toast('已退回 Leader 重新指派'),
  });
  const claim = useApiMutation({
    mutationFn: api.tasks.claimReview,
    onSuccess: (t) => toast(`已領取 ${t.id} 的審查`),
  });
  const startDev = useApiMutation({
    mutationFn: api.tasks.startDevelopment,
    onSuccess: () => toast('已進入 In Progress，記得先複製 Prompt'),
  });
  const submitReview = useApiMutation({
    mutationFn: api.tasks.submitForReview,
    onSuccess: (t) =>
      toast(
        t.policy.mode === 'leader'
          ? '已通知 Leader 審查'
          : t.policy.mode === 'pool'
            ? '已推送到團隊 Review 公共池'
            : '已通知指定審查者',
      ),
  });
  const approve = useApiMutation({
    mutationFn: api.tasks.approveReview,
    onSuccess: (r, id) =>
      toast(r.completed ? `${id} 已完成` : `已核准（${r.approvals}/${r.required}），等待其他審查者`),
  });
  const requestChanges = useApiMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api.tasks.requestChanges(id, note),
    onSuccess: () => toast('已退回負責人修改'),
  });
  const updatePolicy = useApiMutation({
    mutationFn: ({ id, policy }: { id: string; policy: ReviewPolicy }) => api.tasks.updatePolicy(id, policy),
    invalidate: [['tasks']],
  });

  return { accept, negotiate, claim, startDev, submitReview, approve, requestChanges, updatePolicy };
}
