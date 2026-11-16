import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { GenerateDraftInput, GenerateTasksInput, PlanningDraft, ReviseTaskInput } from '@/types';
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

  const revise = useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviseTaskInput }) => api.tasks.revise(id, input),
    onSuccess: (t) => toast(`已更新 ${t.id} 並重新發送通知，任務回到待確認`),
  });

  const updateGoal = useApiMutation({
    mutationFn: ({ id, goal }: { id: number; goal: string }) => api.sprints.updateGoal(id, goal),
    invalidate: [['sprints']],
  });

  return { generate, generateTasks, submit, revise, updateGoal };
}
