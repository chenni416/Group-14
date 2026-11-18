import { capOf, planLoad } from '@/lib/planning';
import type { Member, Task } from '@/types';
import { carryTasks, db, planTasks } from '../db';

type Load = Record<string, number>;

/** 規劃中 Sprint 的每人負載：本次任務 + 上個 Sprint 帶入任務的本輪預估點數 */
export function plannedLoad(sprintId: number, exclude: Task[] = []): Load {
  return planLoad(db.members, planTasks(sprintId), carryTasks(sprintId), exclude.map((t) => t.id));
}

export interface Rank {
  member: Member;
  score: number;
  matched: string[];
  remain: number;
  cap: number;
}

/** 推薦指派：技能標籤 45%、領域 35%、剩餘負擔 20%，超載扣分 */
export function rankFor(task: Task, load: Load, sprintId: number): Rank[] {
  const sprint = db.sprints.find((s) => s.id === sprintId);
  return db.members
    .map((member) => {
      const cap = capOf(sprint, member);
      const matched = task.tags.filter((tag) => member.tags.includes(tag));
      const tagScore = task.tags.length ? matched.length / task.tags.length : 0;
      const domainScore = member.domain === task.domain ? 1 : 0;
      const remain = cap - (load[member.id] ?? 0);
      const capScore = cap > 0 ? Math.max(0, Math.min(1, remain / cap)) : 0;
      const score = 0.45 * tagScore + 0.35 * domainScore + 0.2 * capScore - (remain < task.storyPoints ? 0.6 : 0);
      return { member, score, matched, remain, cap };
    })
    .sort((a, b) => b.score - a.score);
}

/** 從排名中挑人：優先選剩餘點數足夠的；都不夠時，strict 模式挑剩最多的人 */
export function pickRank(ranks: Rank[], storyPoints: number, strict = false): Rank | undefined {
  const fit = ranks.find((r) => r.remain >= storyPoints);
  if (fit) return fit;
  return strict ? [...ranks].sort((a, b) => b.remain - a.remain)[0] : ranks[0];
}

export const reasonFor = (r: Rank) =>
  (r.matched.length ? `吻合其 ${r.matched.join('、')} 技能` : `其為 ${r.member.title}，最接近此任務領域`) +
  `，剩餘負擔 ${r.remain}/${r.cap} SP`;

/** 為新拆解的任務建議指派人與 Review 策略 */
export function suggestAll(list: Task[], sprintId: number, strict = false) {
  const load = plannedLoad(sprintId, list);
  [...list]
    .sort((a, b) => b.storyPoints - a.storyPoints)
    .forEach((task) => {
      const best = pickRank(rankFor(task, load, sprintId), task.storyPoints, strict);
      if (!best) return;
      task.suggestedAssigneeId = task.assigneeId = best.member.id;
      task.edited = false;
      task.suggestReason = reasonFor(best);
      load[best.member.id] = (load[best.member.id] ?? 0) + task.storyPoints;

      if (/資料表|遷移|狀態機/.test(task.storyPointsReason) || (task.domain === 'BE' && task.storyPoints >= 5)) {
        task.policy = { mode: 'leader', targets: [], rule: 'any' };
        task.policyReason = '涉及資料表更動或核心架構，建議 Leader 專審';
      } else if (task.domain === 'DS' || /視覺|卡片/.test(task.title)) {
        const reviewer =
          db.members.find((x) => x.domain === 'DS' && x.id !== task.assigneeId) ??
          db.members.find((x) => x.domain === 'FE' && x.id !== task.assigneeId);
        task.policy = { mode: 'target', targets: reviewer ? [reviewer.id] : [], rule: 'any' };
        task.policyReason = `跨職能：建議由 ${reviewer?.name ?? '設計師'} 確認畫面`;
      } else {
        const def = db.project.defaultPolicy;
        task.policy = { ...def, targets: [...def.targets] };
        task.policyReason = '一般功能，沿用專案預設策略';
      }
    });
}
