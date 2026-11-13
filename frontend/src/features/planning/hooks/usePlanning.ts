import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { CreateTaskInput, UpdateTaskInput } from '@/types';

export const DECOMPOSE_KEY = ['planning', 'decompose'];

export const useMinutes = () => useQuery({ queryKey: ['planning', 'minutes'], queryFn: api.planning.getMinutes, staleTime: Infinity });

export function usePlanningMutations() {
  const decompose = useApiMutation({
    mutationKey: DECOMPOSE_KEY,
    mutationFn: api.planning.decompose,
    invalidate: [['tasks'], ['sprints']],
    onSuccess: ({ created }) =>
      toast(created ? `AI 拆解出 ${created} 項 Sub-task，請審核後核准` : '沒有偵測到新的待辦項目'),
  });
  const approveDrafts = useApiMutation({
    mutationFn: () => api.tasks.approveDrafts(),
    onSuccess: ({ count }) => toast(`已核准 ${count} 項任務並發送指派邀請`),
  });
  const updateTask = useApiMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => api.tasks.update(id, patch),
    invalidate: [['tasks']],
  });
  const removeTask = useApiMutation({ mutationFn: api.tasks.remove, invalidate: [['tasks']] });
  const createTask = useApiMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    invalidate: [['tasks']],
    onSuccess: (t) => toast(`已加入草稿 ${t.id}`),
  });
  const reassign = useApiMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) => api.tasks.reassign(id, assigneeId),
    onSuccess: () => toast('已重新發送指派邀請'),
  });
  const updateGoal = useApiMutation({
    mutationFn: ({ id, goal }: { id: number; goal: string }) => api.sprints.updateGoal(id, goal),
    invalidate: [['sprints']],
  });
  return { decompose, approveDrafts, updateTask, removeTask, createTask, reassign, updateGoal };
}
