import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { CreateSprintInput } from '@/types';

/** 建立 Sprint 對話框的預設值（每次開啟重新取得，帶入最新的延續事項） */
export const useSprintDefaults = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.sprintDefaults, queryFn: api.sprints.defaults, enabled, staleTime: 0, gcTime: 0 });

export function useSprintMutations() {
  const navigate = useNavigate();
  const createSprint = useApiMutation({
    mutationFn: (input: CreateSprintInput) => api.sprints.create(input),
    invalidate: [['sprints'], ['project'], ['backlog'], ['tasks']],
    onSuccess: (sprint) => {
      toast(`已建立 ${sprint.name}，下一步：AI 分析會議紀錄`);
      navigate('/sprints/planning');
    },
  });
  const removeBacklog = useApiMutation({
    mutationFn: api.sprints.removeBacklog,
    invalidate: [['backlog']],
  });
  return { createSprint, removeBacklog };
}
