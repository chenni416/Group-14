import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';

export const useBurndown = (sprintId: number | undefined) =>
  useQuery({
    queryKey: queryKeys.burndown(sprintId ?? -1),
    queryFn: () => api.sprints.burndown(sprintId!),
    enabled: sprintId != null,
  });
