import type { Member, Task } from '@/types';

export const isLead = (member: Member | undefined) => member?.role === 'Leader';

/** 使用者是否能對此任務按下核准 / 要求修改 */
export function canReview(task: Task, userId: string): boolean {
  if (task.state !== 'IN_REVIEW' || userId === task.assigneeId) return false;
  const { mode, targets } = task.policy;
  if (mode === 'leader' || mode === 'pool') return task.reviewerId === userId;
  return targets.includes(userId) && !task.approvals.includes(userId);
}

/** 公共池中尚未被認領、且使用者可以認領的任務 */
export const canClaim = (task: Task, userId: string) =>
  task.state === 'IN_REVIEW' &&
  task.policy.mode === 'pool' &&
  !task.reviewerId &&
  task.assigneeId !== userId;

export const needsMyReview = (task: Task, userId: string) =>
  canReview(task, userId) || canClaim(task, userId);

export const canEditPolicy = (task: Task, user: Member | undefined) =>
  !!user &&
  task.state !== 'IN_REVIEW' &&
  task.state !== 'DONE' &&
  (isLead(user) || task.assigneeId === user.id);
