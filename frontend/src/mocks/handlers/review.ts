import { ApiError } from '@/types';
import { enrichPr } from '../data/delivery';
import { db, leader, notify, nowIso, type TaskRecord } from '../db';

/** 發布 PR 並依 Review 策略路由通知（PR 資料為 mock，不串 GitHub） */
export function sendToReview(task: TaskRecord, prUrl?: string) {
  const { policy } = task;
  if (policy.mode === 'target' && !policy.targets.length) {
    throw new ApiError('指定成員模式至少需選一位審查者');
  }
  task.state = 'IN_REVIEW';
  const fromUrl = Number(prUrl?.match(/(\d+)\/?$/)?.[1]);
  task.pr = enrichPr(task, { number: fromUrl > 0 ? fromUrl : 35 + Math.floor(Math.random() * 40), status: 'open' });
  if (prUrl?.trim()) task.pr.url = prUrl.trim();
  task.reviewStartedAt = nowIso();
  task.approvals = [];
  task.reviewerId = null;
  task.claimedAt = null;
  const prNo = task.pr.number;

  if (policy.mode === 'leader') {
    const lead = leader();
    task.reviewerId = lead.id;
    notify(lead.id, 'review', task.id, task.assigneeId, `請你以 Leader 身分審查 PR #${prNo}`);
  } else if (policy.mode === 'pool') {
    db.members
      .filter((m) => m.id !== task.assigneeId)
      .forEach((m) => notify(m.id, 'pool', task.id, task.assigneeId, `PR #${prNo} 已開啟，任何有空的成員都可以領取審查`));
  } else {
    policy.targets.forEach((id) =>
      notify(id, 'review', task.id, task.assigneeId, `請你審查 PR #${prNo}（${policy.rule === 'all' ? '需全員同意' : '需 1 人同意'}）`),
    );
  }
}

export function canReview(task: TaskRecord, userId: string) {
  if (task.state !== 'IN_REVIEW' || userId === task.assigneeId) return false;
  const { mode, targets } = task.policy;
  if (mode === 'leader' || mode === 'pool') return task.reviewerId === userId;
  return targets.includes(userId) && !task.approvals.includes(userId);
}
