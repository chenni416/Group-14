import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/useApiMutation';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import type { CreateSprintInput } from '@/types';

/** 建立 Sprint 的預設值（每次進入新建模式重新取得，帶入最新的延續事項） */
export const useSprintDefaults = (enabled: boolean) =>
  useQuery({ queryKey: queryKeys.sprintDefaults, queryFn: api.sprints.defaults, enabled, staleTime: 0, gcTime: 0 });

export function useSprintMutations() {
  /** 建立後的提示與後續動作（例如接著 AI 分析）由呼叫端決定 */
  const createSprint = useApiMutation({
    mutationFn: (input: CreateSprintInput) => api.sprints.create(input),
    invalidate: [['sprints'], ['project'], ['backlog'], ['tasks']],
  });
  const removeBacklog = useApiMutation({
    mutationFn: api.sprints.removeBacklog,
    invalidate: [['backlog']],
  });
  return { createSprint, removeBacklog };
}
