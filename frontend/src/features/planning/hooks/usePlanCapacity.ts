import { useMemo } from 'react';
import { useSprintContext } from '@/hooks/queries';
import { capOf, carryLoad } from '@/lib/planning';
import type { Member } from '@/types';

/**
 * 規劃階段的容量基準：本輪 Capacity（設定頁填的點數）扣掉上輪帶入任務佔用的點數。
 * planMembers 的 capacity 已換成「可分配給新任務的點數」，可以直接交給 Story／Task／派工總覽使用。
 */
export function usePlanCapacity(members: Member[]) {
  const { planning, carryTasks } = useSprintContext();
  return useMemo(() => {
    const carry = carryLoad(members, carryTasks);
    const planMembers = members.map((m) => ({ ...m, capacity: Math.max(0, capOf(planning, m) - (carry[m.id] ?? 0)) }));
    return { planMembers, carry };
  }, [members, planning, carryTasks]);
}
