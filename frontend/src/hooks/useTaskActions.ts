import { api } from '@/services';
import type { ReviewItemsInput } from '@/services';
import { toast } from '@/stores/toast.store';
import type { NegotiateInput, ReviewPolicy, SubmitDeliveryInput } from '@/types';
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
  const confirmPlan = useApiMutation({
    mutationFn: ({ id, status, note }: { id: string; status: 'agree' | 'object'; note: string }) => api.tasks.confirmPlan(id, status, note),
    onSuccess: (_t, v) => toast(v.status === 'agree' ? '已同意' : '已提出異議，Leader 會看到你的原因'),
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
    mutationFn: ({ id, delivery }: { id: string; delivery?: SubmitDeliveryInput }) => api.tasks.submitForReview(id, delivery),
    invalidate: [['tasks'], ['notifications'], ['sprints'], ['execution']],
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
    mutationFn: ({ id, items }: { id: string; items?: ReviewItemsInput }) => api.tasks.approveReview(id, items),
    onSuccess: (r, v) =>
      toast(r.completed ? `${v.id} 已完成，驗收紀錄已保存` : `已核准（${r.approvals}/${r.required}），等待其他審查者`),
  });
  const requestChanges = useApiMutation({
    mutationFn: ({ id, note, items }: { id: string; note: string; items?: ReviewItemsInput }) => api.tasks.requestChanges(id, note, items),
    onSuccess: () => toast('已退回負責人修改，驗收紀錄已保存'),
  });
  const updatePolicy = useApiMutation({
    mutationFn: ({ id, policy }: { id: string; policy: ReviewPolicy }) => api.tasks.updatePolicy(id, policy),
    invalidate: [['tasks']],
  });

  return { accept, negotiate, confirmPlan, claim, startDev, submitReview, approve, requestChanges, updatePolicy };
}
