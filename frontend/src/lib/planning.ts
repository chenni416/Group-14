import type { Member, PlanningDraft, ReviewPolicy, ReviewerAssignment, TaskDraft } from '@/types';

/** 分支命名：{前綴}/S{Sprint編號}{Story序號}{Task序號}-{摘要敘述} */
export function branchName(draft: Pick<PlanningDraft, 'sprintId' | 'stories' | 'tasks'>, task: TaskDraft): string {
  const storyIdx = draft.stories.findIndex((s) => s.id === task.storyId) + 1;
  const taskIdx = draft.tasks.filter((t) => t.storyId === task.storyId).findIndex((t) => t.id === task.id) + 1;
  return `${task.branchPrefix}/S${draft.sprintId}${storyIdx}${taskIdx}-${task.branchSlug || 'task'}`;
}

/** 各成員已分配的 Story Points */
export function loadByMember(members: Member[], tasks: TaskDraft[]): Record<string, number> {
  const load: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  tasks.forEach((t) => {
    if (t.assigneeId) load[t.assigneeId] = (load[t.assigneeId] ?? 0) + t.storyPoints;
  });
  return load;
}

export const REVIEWER_LABELS: Record<ReviewerAssignment['mode'], string> = {
  pool: '團隊開放搶單',
  leader: '指定 Leader 審核',
  member: '指定特定成員',
};

export function reviewerSummary(r: ReviewerAssignment, members: Map<string, Member>): string {
  if (r.mode === 'member') return r.memberId ? `指定 ${members.get(r.memberId)?.name ?? '成員'} 審查` : '尚未選擇審查成員';
  return REVIEWER_LABELS[r.mode];
}

/** 摘要敘述轉成 kebab-case */
export const toSlug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** 正式任務的 ReviewPolicy ↔ 規劃時的審查人員安排 */
export const policyToReviewer = (p: ReviewPolicy): ReviewerAssignment =>
  p.mode === 'target' ? { mode: 'member', memberId: p.targets[0] ?? null } : { mode: p.mode, memberId: null };

export const reviewerToPolicy = (r: ReviewerAssignment): ReviewPolicy =>
  r.mode === 'member'
    ? { mode: 'target', targets: r.memberId ? [r.memberId] : [], rule: 'any' }
    : { mode: r.mode, targets: [], rule: 'any' };
