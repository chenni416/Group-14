import { useMemo } from 'react';
import { useBacklog, useSprintContext } from '@/hooks/queries';

/** 上輪統整是否已全部決定（未完成任務與延續事項） */
export function useCarryReview() {
  const ctx = useSprintContext();
  const { data: backlog = [] } = useBacklog();
  const planningId = ctx.planning?.id ?? null;
  const items = useMemo(
    () => backlog.filter((b) => b.usedInSprintId == null || b.usedInSprintId === planningId),
    [backlog, planningId],
  );
  const undecided = ctx.carryTasks.filter((t) => t.carry == null).length + items.filter((b) => b.decision == null).length;
  return { ...ctx, backlogItems: items, undecided, ready: !ctx.isLoading && undecided === 0 };
}
