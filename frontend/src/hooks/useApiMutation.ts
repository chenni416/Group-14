import { useMutation, useQueryClient, type MutationKey, type QueryKey } from '@tanstack/react-query';
import { toast } from '@/stores/toast.store';

interface Options<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>;
  mutationKey?: MutationKey;
  /** 成功後要重新抓取的 query；預設為任務相關資料 */
  invalidate?: QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void;
}

const TASK_KEYS: QueryKey[] = [['tasks'], ['notifications'], ['sprints']];

/** 統一處理錯誤提示與快取失效的 mutation */
export function useApiMutation<TVars = void, TData = unknown>({
  mutationFn,
  mutationKey,
  invalidate = TASK_KEYS,
  onSuccess,
}: Options<TVars, TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey,
    mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((queryKey) => qc.invalidateQueries({ queryKey })));
      onSuccess?.(data, vars);
    },
    onError: (err) => toast(err instanceof Error ? err.message : '發生未知錯誤'),
  });
}
