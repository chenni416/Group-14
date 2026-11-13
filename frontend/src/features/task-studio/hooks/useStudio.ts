import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { ChatMessage } from '@/types';

export const usePrompt = (taskId: string) =>
  useQuery({ queryKey: queryKeys.prompt(taskId), queryFn: () => api.studio.getPrompt(taskId) });

export const useChat = (taskId: string) =>
  useQuery({ queryKey: queryKeys.chat(taskId), queryFn: () => api.studio.getChat(taskId) });

export function useSetPromptVersion(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => api.studio.setPromptVersion(taskId, version),
    onSuccess: (state) => qc.setQueryData(queryKeys.prompt(taskId), state),
  });
}

/** 送出問題：先樂觀地顯示使用者訊息，回覆後同步 Prompt 版本 */
export function useAsk(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => api.studio.ask(taskId, question),
    onMutate: async (question) => {
      await qc.cancelQueries({ queryKey: queryKeys.chat(taskId) });
      qc.setQueryData<ChatMessage[]>(queryKeys.chat(taskId), (prev = []) => [
        ...prev,
        { id: `pending-${Date.now()}`, role: 'user', text: question },
      ]);
    },
    onError: (err) => toast(err instanceof Error ? err.message : '傳送失敗'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.chat(taskId) });
      qc.invalidateQueries({ queryKey: queryKeys.prompt(taskId) });
    },
  });
}
