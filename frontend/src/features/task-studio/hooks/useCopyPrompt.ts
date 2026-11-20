import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';

/** 取得任務目前版本的 Prompt 並複製 */
export function useCopyPrompt() {
  const qc = useQueryClient();
  const copy = useCopyToClipboard();
  return useCallback(
    async (taskId: string) => {
      const state = await qc.fetchQuery({ queryKey: queryKeys.prompt(taskId), queryFn: () => api.studio.getPrompt(taskId) });
      const lines = state.versions[state.current] ?? [];
      await copy(lines.join('\n'), `已複製 ${taskId} 的 Prompt，可直接貼到 Claude Code`);
    },
    [qc, copy],
  );
}
