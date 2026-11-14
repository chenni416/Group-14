import { BOARD_STATES, DRAFT_STATES, type ClarifyQuestion, type Dependency, type Member, type ReturnSnapshot, type ReviewPolicy, type Sprint, type Task } from '@/types';
import { REVIEW_POLICIES } from './constants';
import { mention, sum } from './format';

/**
 * Sprint 規劃的共用規則（純函式）。
 * 前端用來即時顯示，mock 後端用同一套規則驗證，確保兩邊結果一致。
 */

/** Planning Studio 四步驟 */
export const PLANNING_STEPS = ['輸入', 'AI 拆解', '審核調整', '核准發送'] as const;

/** Review 策略對應的審查人說明 */
export const reviewerText = (p: ReviewPolicy, names: Map<string, string>, leaderName?: string) =>
  p.mode === 'leader'
    ? `審查人：${mention(leaderName)}`
    : p.mode === 'pool'
      ? '審查人：開放認領（負責人以外皆可）'
      : `審查人：${p.targets.length ? p.targets.map((t) => mention(names.get(t))).join('、') : '（尚未選擇）'} · ${p.rule === 'all' ? '需全員同意' : '需 1 人同意'}`;

/** 本次 Capacity：Sprint 建立時直接預估的點數，沒有設定時用成員預設值 */
export const capOf = (sprint: Pick<Sprint, 'capacity'> | undefined, member: Member) =>
  sprint?.capacity[member.id] ?? member.capacity;

export const capTotal = (sprint: Pick<Sprint, 'capacity'> | undefined, members: Member[]) =>
  sum(members.map((m) => capOf(sprint, m)));

export const isUnfinished = (t: Task) =>
  (BOARD_STATES as readonly string[]).includes(t.state) && t.state !== 'DONE';

/** 上個 Sprint 帶入任務的剩餘點數估計 */
export const carrySP = (t: Task) =>
  t.state === 'IN_REVIEW' ? 1 : t.state === 'IN_PROGRESS' ? Math.ceil(t.storyPoints / 2) : t.storyPoints;

/** 規劃中 Sprint 的每人負載 = 本次任務點數 + 帶入任務的剩餘點數 */
export function planLoad(members: Member[], planTasks: Task[], carryTasks: Task[], excludeIds: string[] = []) {
  const load: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  planTasks.forEach((t) => {
    const cur = load[t.assigneeId];
    if (t.state === 'DEFERRED' || !t.assigneeId || excludeIds.includes(t.id) || cur == null) return;
    load[t.assigneeId] = cur + t.storyPoints;
  });
  carryTasks.forEach((t) => {
    const cur = load[t.assigneeId];
    if (t.carry && cur != null) load[t.assigneeId] = cur + carrySP(t);
  });
  return load;
}

/** 核准前必須補齊的欄位 */
export function taskProblems(t: Task): string[] {
  const out: string[] = [];
  if (!t.assigneeId) out.push('沒有負責人');
  if (!t.acceptanceCriteria.length) out.push('沒有驗收條件');
  if (t.policy.mode === 'target' && !t.policy.targets.length) out.push('指定審查但未選人員');
  return out;
}

export const snapshotOf = (t: Task): ReturnSnapshot => ({
  title: t.title,
  acceptanceCriteria: [...t.acceptanceCriteria],
  storyPoints: t.storyPoints,
  storyPointsReason: t.storyPointsReason,
  assigneeId: t.assigneeId,
  policy: { ...t.policy, targets: [...t.policy.targets] },
});

/** 協商退回後，Leader 修改了哪些地方 */
export function changesSinceReturn(t: Task, nameOf: (id: string) => string): string[] {
  const s = t.returnSnapshot;
  if (!s) return [];
  const out: string[] = [];
  if (s.title !== t.title) out.push(`標題改為「${t.title}」`);
  if (s.storyPoints !== t.storyPoints) out.push(`點數 ${s.storyPoints} → ${t.storyPoints}`);
  else if (s.storyPointsReason !== t.storyPointsReason) out.push('估點理由已更新');
  if (s.acceptanceCriteria.join('\n') !== t.acceptanceCriteria.join('\n')) out.push('驗收條件已調整');
  if (s.assigneeId !== t.assigneeId) out.push(`負責人 ${nameOf(s.assigneeId)} → ${nameOf(t.assigneeId)}`);
  if (
    s.policy.mode !== t.policy.mode ||
    s.policy.rule !== t.policy.rule ||
    s.policy.targets.join() !== t.policy.targets.join()
  )
    out.push(`Review 改為${REVIEW_POLICIES[t.policy.mode].label}`);
  return out;
}

export interface PlanContext {
  sprint: Sprint;
  members: Member[];
  /** 規劃中 Sprint 的任務（不含延後） */
  planTasks: Task[];
  /** 上個 Sprint 未完成的任務 */
  carryTasks: Task[];
  dependencies: Dependency[];
}

export interface PreflightResult {
  drafts: Task[];
  over: Array<{ member: Member; load: number; cap: number }>;
  missing: Array<{ task: Task; problems: string[] }>;
  unanswered: ClarifyQuestion[];
  /** 依賴已延後的前置任務（可略過） */
  risky: Dependency[];
  /** 有必須處理的問題 */
  blocked: boolean;
}

export function preflight({ sprint, members, planTasks, carryTasks, dependencies }: PlanContext): PreflightResult {
  const load = planLoad(members, planTasks, carryTasks);
  const drafts = planTasks.filter((t) => DRAFT_STATES.includes(t.state));
  const over = members
    .map((member) => ({ member, load: load[member.id] ?? 0, cap: capOf(sprint, member) }))
    .filter((x) => x.load > x.cap);
  const missing = drafts.map((task) => ({ task, problems: taskProblems(task) })).filter((x) => x.problems.length);
  const unanswered = (sprint.questions ?? []).filter((q) => !q.answer);
  const draftIds = new Set(drafts.map((t) => t.id));
  const risky = dependencies.filter((d) => d.risk === 'high' && draftIds.has(d.taskId));
  return { drafts, over, missing, unanswered, risky, blocked: !!(over.length || missing.length || unanswered.length) };
}

/**
 * 容量不足時建議延後的任務：
 * 總量超過 → 優先延後依賴上個 Sprint 未完成任務者，再依點數由大到小；
 * 總量足夠但個人超量 → 延後該成員最小、足以解決超量的任務。
 * Leader 調整過的任務不會被建議。
 */
export function deferSuggestions({ sprint, members, planTasks, carryTasks, dependencies }: PlanContext): Task[] {
  const load = planLoad(members, planTasks, carryTasks);
  const need = sum(Object.values(load));
  let over = need - capTotal(sprint, members);
  const candidates = planTasks.filter((t) => DRAFT_STATES.includes(t.state) && !t.edited);
  if (over > 0) {
    const dep = new Set(dependencies.filter((d) => d.risk !== 'ok').map((d) => d.taskId));
    const sorted = [...candidates].sort((a, b) => Number(dep.has(b.id)) - Number(dep.has(a.id)) || b.storyPoints - a.storyPoints);
    const out: Task[] = [];
    for (const t of sorted) {
      if (over <= 0) break;
      out.push(t);
      over -= t.storyPoints;
    }
    return out;
  }
  const overMember = members.find((m) => (load[m.id] ?? 0) > capOf(sprint, m));
  if (!overMember) return [];
  const excess = (load[overMember.id] ?? 0) - capOf(sprint, overMember);
  const mine = candidates.filter((t) => t.assigneeId === overMember.id).sort((a, b) => a.storyPoints - b.storyPoints);
  const pick = mine.find((t) => t.storyPoints >= excess) ?? mine[mine.length - 1];
  return pick ? [pick] : [];
}

/* ---------- 會議紀錄 ---------- */

const BULLET = /^\s*([-*•]|\d+[.)、])\s+/;
export const isBullet = (line: string) => BULLET.test(line);

/** 去掉項目符號與「[延續] / [延後] / [跨 Sprint]」標記 */
export const stripBullet = (line: string) =>
  line
    .replace(/^\s*([-*•]|\d+[.)、])\s+(\[[ xX]\]\s*)?/, '')
    .replace(/^\[(延續|延後|跨 Sprint)\]\s*/, '')
    .trim();

/** 去掉延續事項後面的「（Sprint 2 延後）」說明 */
export const stripCarryNote = (text: string) => text.replace(/（[^）]*(延後|延續)[^）]*）$/, '').trim();

export const bulletLines = (minutes: string) => minutes.split('\n').filter(isBullet).map(stripBullet);

/** 這一行是不是任務的來源句 */
export function lineMatchesSource(line: string, source: string | null | undefined) {
  if (!source || !isBullet(line)) return false;
  const text = stripCarryNote(stripBullet(line));
  return text.length > 3 && (text === source || text.includes(source) || source.includes(text));
}

/* ---------- 日期 ---------- */

const pad = (n: number) => String(n).padStart(2, '0');
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
export const monthDay = (iso: string) => {
  const [, m = '', d = ''] = iso.split('-');
  return `${m}/${d}`;
};
/** 從 iso 起算的 n 個工作日標籤 */
export function workdayLabels(iso: string, n: number) {
  const out: string[] = [];
  const d = new Date(`${iso}T00:00:00`);
  while (out.length < n) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) out.push(`${d.getMonth() + 1}/${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
