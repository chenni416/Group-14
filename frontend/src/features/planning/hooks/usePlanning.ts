import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { GenerateDraftInput, GenerateTasksInput, PlanningDraft } from '@/types';
import { usePlanningStore } from '../store';

export const useMinutes = () =>
  useQuery({ queryKey: ['planning', 'minutes'], queryFn: api.planning.getMinutes, staleTime: Infinity });

export function usePlanningMutations() {
  const navigate = useNavigate();
  const { loadDraft, appendTasks, setStage, reset } = usePlanningStore();

  const generate = useApiMutation({
    mutationFn: (input: GenerateDraftInput) => api.planning.generateDraft(input),
    invalidate: [['sprints']],
    onSuccess: (draft) => {
      loadDraft(draft);
      toast(`AI 切分出 ${draft.stories.length} 個 Story，請確認範疇與預估點數`);
    },
  });

  const generateTasks = useApiMutation({
    mutationKey: ['planning', 'generate-tasks'],
    mutationFn: (input: GenerateTasksInput) => api.planning.generateTasks(input),
    invalidate: [],
    onSuccess: (tasks, input) => {
      appendTasks(tasks);
      setStage('tasks');
      toast(`已依 ${input.stories.length} 個 Story 拆解出 ${tasks.length} 張 Task，全部進入未指派`);
    },
  });

  const submit = useApiMutation({
    mutationFn: (draft: PlanningDraft) => api.planning.submitPlan(draft),
    onSuccess: ({ count }) => {
      reset();
      toast(`已確認派工並通知成員（共 ${count} 張任務），進入確認與認領`);
      navigate('/inbox');
    },
  });

  const reassign = useApiMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) => api.tasks.reassign(id, assigneeId),
    onSuccess: () => toast('已重新發送指派邀請'),
  });

  const updateGoal = useApiMutation({
    mutationFn: ({ id, goal }: { id: number; goal: string }) => api.sprints.updateGoal(id, goal),
    invalidate: [['sprints']],
  });

  return { generate, generateTasks, submit, reassign, updateGoal };
}
