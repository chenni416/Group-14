import { useCallback } from 'react';
import { toast } from '@/stores/toast.store';
import type { Member } from '@/types';
import { usePlanningStore } from '../store';

/**
 * 指派或退回未指派（memberId 為 null），並給予提示。
 * 下拉選單、拖曳、套用建議都走這裡，自動收合與推進焦點的規則由 store.assignTask 統一處理。
 */
export function useAssignDraftTask(members: Member[]) {
  const assignTask = usePlanningStore((s) => s.assignTask);
  const tasks = usePlanningStore((s) => s.draft?.tasks);

  return useCallback(
    (taskId: string, memberId: string | null) => {
      const task = tasks?.find((t) => t.id === taskId);
      if (!task || task.assigneeId === memberId) return;
      assignTask(taskId, memberId);
      const name = members.find((m) => m.id === memberId)?.name;
      toast(memberId ? `已將 ${task.code} 指派給 ${name ?? '成員'}` : `已將 ${task.code} 退回未指派`);
    },
    [members, tasks, assignTask],
  );
}
