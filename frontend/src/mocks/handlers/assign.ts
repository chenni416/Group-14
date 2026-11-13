import type { Member, Task } from '@/types';
import { db, sprintTasks } from '../db';

type Load = Record<string, number>;

export function plannedLoad(sprintId: number, exclude: Task[] = []): Load {
  const load: Load = Object.fromEntries(db.members.map((m) => [m.id, 0]));
  sprintTasks(sprintId).forEach((t) => {
    if (!exclude.includes(t)) load[t.assigneeId] = (load[t.assigneeId] ?? 0) + t.storyPoints;
  });
  return load;
}

interface Rank {
  member: Member;
  score: number;
  matched: string[];
  remain: number;
}

/** 推薦指派：技能標籤 45%、領域 35%、剩餘負擔 20%，超載扣分 */
export function rankFor(task: Task, load: Load): Rank[] {
  return db.members
    .map((member) => {
      const matched = task.tags.filter((tag) => member.tags.includes(tag));
      const tagScore = task.tags.length ? matched.length / task.tags.length : 0;
      const domainScore = member.domain === task.domain ? 1 : 0;
      const remain = member.capacity - (load[member.id] ?? 0);
      const capScore = Math.max(0, Math.min(1, remain / member.capacity));
      const score = 0.45 * tagScore + 0.35 * domainScore + 0.2 * capScore - (remain < task.storyPoints ? 0.6 : 0);
      return { member, score, matched, remain };
    })
    .sort((a, b) => b.score - a.score);
}

/** 為新拆解的任務建議指派人與 Review 策略 */
export function suggestAll(list: Task[]) {
  const load = plannedLoad(db.project.planningSprintId, list);
  [...list]
    .sort((a, b) => b.storyPoints - a.storyPoints)
    .forEach((task) => {
      const best = rankFor(task, load)[0];
      if (!best) return;
      const { member, matched, remain } = best;
      task.suggestedAssigneeId = task.assigneeId = member.id;
      task.edited = false;
      task.suggestReason =
        (matched.length ? `吻合其 ${matched.join('、')} 技能` : `其為 ${member.title}，最接近此任務領域`) +
        `，剩餘負擔 ${remain}/${member.capacity} SP`;
      load[member.id] = (load[member.id] ?? 0) + task.storyPoints;

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
