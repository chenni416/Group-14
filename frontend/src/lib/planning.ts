import {
  BOARD_STATES,
  type BacklogItem,
  DRAFT_STATES,
  type ClarifyQuestion,
  type Dependency,
  type Member,
  type PlanningDraft,
  type ReturnSnapshot,
  type ReviewPolicy,
  type ReviewerAssignment,
  type Sprint,
  type Task,
  type TaskDraft,
} from '@/types';
import { REVIEW_POLICIES } from './constants';
import { sum } from './format';

/**
 * Sprint 規劃的共用規則（純函式）。
 * 前端用來即時顯示，mock 後端用同一套規則驗證，確保兩邊結果一致。
 */

/** 規劃流程五階段（與 PlanningStepper 對應，Sprint 列表的進度徽章使用） */
export const PLANNING_STEPS = ['上輪 Sprint 統整', '開啟 Sprint 與設定', 'Story 分析確認', 'Task 拆解與派工', '派工總覽與發送'] as const;

/* ---------- 規劃草稿（Planning Studio） ---------- */

/** Story 編號：S{Sprint}-{Story 序號}，例如 S3-2 */
export const storyCode = (sprintId: number, no: number) => `S${sprintId}-${no}`;

/** Task 編號：S-{Sprint}{Story 序號}{Task 序號}，例如 S-321；數字與分支名稱的 S321 相同，方便對照查詢 */
export const taskCode = (sprintId: number, storyNo: number, no: number) => `S-${sprintId}${storyNo}${no}`;

/** 分支命名：{前綴}/S{Sprint}{Story 序號}{Task 序號}-{摘要敘述}，數字取自 Task 編號 */
export function branchName(task: Pick<TaskDraft, 'code' | 'branchPrefix' | 'branchSlug'>): string {
  return `${task.branchPrefix}/S${task.code.replace(/^S-/, '')}-${task.branchSlug || 'task'}`;
}

/** 補齊舊草稿缺少的欄位（相依、序號） */
export function normalizeDraft(draft: PlanningDraft): PlanningDraft {
  const stories = draft.stories.map((s, i) => ({ ...s, no: s.no ?? i + 1, dependsOn: s.dependsOn ?? [] }));
  const tasks = draft.tasks.map((t) => ({ ...t, no: t.no ?? 0, dependsOn: t.dependsOn ?? [] }));
  return { sprintId: draft.sprintId, stories, tasks };
}

/** 本輪要處理的項目（排除延後） */
export const isActive = (x: { deferred?: boolean }) => !x.deferred;
export const activeTasks = (draft: Pick<PlanningDraft, 'tasks'>) => draft.tasks.filter(isActive);

/* ---------- 相依性與延後（規劃草稿） ---------- */

type DepNode = { id: string; dependsOn: { id: string }[] };

/** 依賴 id 的項目（直接） */
export const dependentsOf = <T extends DepNode>(items: T[], id: string) => items.filter((x) => x.dependsOn.some((d) => d.id === id));

/** 加入 from → to 的相依是否會形成循環（to 已經直接或間接依賴 from） */
export function wouldCycle(items: DepNode[], from: string, to: string): boolean {
  if (from === to) return true;
  const map = new Map(items.map((x) => [x.id, x]));
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    map.get(cur)?.dependsOn.forEach((d) => stack.push(d.id));
  }
  return false;
}

/** 延後 ids 時，所有直接或間接依賴它們的項目（不含 ids 本身） */
export function dependentClosure<T extends DepNode>(items: T[], ids: string[]): T[] {
  const out = new Map<string, T>();
  const queue = [...ids];
  while (queue.length) {
    const id = queue.shift()!;
    dependentsOf(items, id).forEach((x) => {
      if (ids.includes(x.id) || out.has(x.id)) return;
      out.set(x.id, x);
      queue.push(x.id);
    });
  }
  return [...out.values()];
}

export interface DependencyIssue {
  /** blocking：依賴的項目已延後，送出前必須處理；warning：只提示 */
  level: 'blocking' | 'warning';
  kind: 'story' | 'task';
  /** 有問題的項目（依賴方） */
  itemId: string;
  itemCode: string;
  /** 被依賴的項目 */
  depId: string;
  depCode: string;
  text: string;
}

/**
 * 送出前的相依檢查（只看本輪要處理的項目）：
 * - 需等待的 Story／Task 已延後 → blocking
 * - 需等待的 Task 尚未指派、需等待的上輪任務已延後 → warning
 */
export function dependencyIssues(draft: Pick<PlanningDraft, 'stories' | 'tasks'>, carryTasks: Task[]): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const stories = new Map(draft.stories.map((s) => [s.id, s]));
  const tasks = new Map(draft.tasks.map((t) => [t.id, t]));
  const carry = new Map(carryTasks.map((t) => [t.id, t]));

  draft.stories.filter(isActive).forEach((s) =>
    s.dependsOn.forEach((d) => {
      const dep = stories.get(d.id);
      if (dep?.deferred)
        issues.push({ level: 'blocking', kind: 'story', itemId: s.id, itemCode: s.code, depId: dep.id, depCode: dep.code, text: `${s.code} 需等待的 ${dep.code} 已延後` });
    }),
  );
  draft.tasks.filter(isActive).forEach((t) =>
    t.dependsOn.forEach((d) => {
      const base = { kind: 'task' as const, itemId: t.id, itemCode: t.code, depId: d.id };
      const dep = tasks.get(d.id);
      if (dep?.deferred) return issues.push({ ...base, level: 'blocking', depCode: dep.code, text: `${t.code} 需等待的 ${dep.code} 已延後` });
      if (dep && !dep.assigneeId) return issues.push({ ...base, level: 'warning', depCode: dep.code, text: `${t.code} 需等待的 ${dep.code} 尚未指派` });
      const prev = carry.get(d.id);
      if (prev && prev.carry === false)
        issues.push({ ...base, level: 'warning', depCode: prev.id, text: `${t.code} 需等待上輪的 ${prev.id}，但它已延後到之後的 Sprint` });
    }),
  );
  return issues;
}

/** 相依關係中的一端（顯示用） */
export interface DepRef {
  id: string;
  code: string;
  title: string;
  reason: string;
  deferred: boolean;
  /** 上輪帶入的任務 */
  carry: boolean;
  assigned: boolean;
}

export interface DepAdvice {
  /** defer 建議延後、next 可能延至下輪、wait 依順序完成但前置未指派、order 依順序本輪完成、first 優先完成 */
  kind: 'defer' | 'next' | 'wait' | 'order' | 'first';
  label: string;
  text: string;
}

export interface DepPlan {
  /** 完成順位：沒有需等待的項目為 1，每多一層前置 +1 */
  order: number;
  /** 包含自己在內、最長前置鏈的點數總和 */
  chainSp: number;
  chain: string[];
  /** 需先完成（等待它們完成後接續） */
  waitFor: DepRef[];
  /** 完成後才能接續的項目 */
  unlocks: DepRef[];
  advice: DepAdvice | null;
}

const codesText = (refs: { code: string }[]) => refs.map((r) => r.code).join('、');

/**
 * 相依排序與建議（Story 與 Task 分開計算）：
 * - 需等待的項目已延後 → 建議延後
 * - 前置鏈總點數超過 limit（Task 用單人本輪 Capacity 上限、Story 用全隊 Capacity）→ 可能延至下輪
 * - 有需等待的項目 → 第 N 順位，等它們完成後接續（前置未指派時以橘色提醒）
 * - 只有後續項目 → 建議優先完成
 * 已延後的項目若仍有本輪項目需要它，提示一起延後或取消延後。
 */
export function dependencyPlan(
  items: { id: string; code: string; title: string; points: number; deferred?: boolean; assigned: boolean; dependsOn: { id: string; reason: string }[] }[],
  external: Map<string, { code: string; title: string; points: number; deferred: boolean }>,
  limit: number,
): Map<string, DepPlan> {
  const byId = new Map(items.map((x) => [x.id, x]));
  const ref = (id: string, reason: string): DepRef | null => {
    const x = byId.get(id);
    if (x) return { id, code: x.code, title: x.title, reason, deferred: !!x.deferred, carry: false, assigned: x.assigned };
    const e = external.get(id);
    return e ? { id, code: e.code, title: e.title, reason, deferred: e.deferred, carry: true, assigned: true } : null;
  };

  const memo = new Map<string, { order: number; chainSp: number; chain: string[] }>();
  const walk = (id: string, seen: Set<string>): { order: number; chainSp: number; chain: string[] } => {
    const hit = memo.get(id);
    if (hit) return hit;
    const x = byId.get(id);
    const e = external.get(id);
    if (!x) return { order: 1, chainSp: e && !e.deferred ? e.points : 0, chain: e ? [e.code] : [] };
    let best = { order: 0, chainSp: 0, chain: [] as string[] };
    if (!seen.has(id)) {
      const next = new Set(seen).add(id);
      x.dependsOn.forEach((d) => {
        const dep = byId.get(d.id);
        if ((dep && dep.deferred) || (!dep && !external.has(d.id))) return;
        const r = walk(d.id, next);
        if (r.chainSp > best.chainSp || r.order > best.order) best = r;
      });
    }
    const out = { order: best.order + 1, chainSp: best.chainSp + x.points, chain: [...best.chain, x.code] };
    memo.set(id, out);
    return out;
  };

  const plans = new Map<string, DepPlan>();
  items.forEach((x) => {
    const waitFor = x.dependsOn.map((d) => ref(d.id, d.reason)).filter((r): r is DepRef => r != null);
    const unlocks = items
      .filter((y) => y.dependsOn.some((d) => d.id === x.id))
      .map((y) => ({ ...ref(y.id, y.dependsOn.find((d) => d.id === x.id)!.reason)! }));
    const { order, chainSp, chain } = x.deferred ? { order: 0, chainSp: 0, chain: [] } : walk(x.id, new Set());
    const activeUnlocks = unlocks.filter((u) => !u.deferred);
    let advice: DepAdvice | null = null;

    if (x.deferred) {
      if (activeUnlocks.length)
        advice = { kind: 'defer', label: '影響後續', text: `已延後，但 ${codesText(activeUnlocks)} 需要它先完成才能銜接；建議一起延後，或取消延後。` };
    } else {
      const deferredWait = waitFor.filter((w) => w.deferred);
      const pendingWait = waitFor.filter((w) => !w.deferred && !w.assigned);
      if (deferredWait.length)
        advice = { kind: 'defer', label: '建議延後', text: `需等待的 ${codesText(deferredWait)} 已延後，本輪無法銜接；建議一起延後到下輪，或移除相依。` };
      else if (chain.length > 1 && chainSp > limit)
        advice = {
          kind: 'next',
          label: '可能延至下輪',
          text: `前置鏈 ${chain.join(' → ')} 共 ${chainSp} SP，超過一輪約 ${limit} SP 的進度；建議提早開始前置項目，若來不及就延至下輪。`,
        };
      else if (waitFor.length)
        advice = {
          kind: pendingWait.length ? 'wait' : 'order',
          label: `第 ${order} 順位`,
          text: `建議本輪完成：等 ${codesText(waitFor)} 完成後接續。${pendingWait.length ? `其中 ${codesText(pendingWait)} 還沒有負責人，指派後才能確定銜接時間。` : ''}`,
        };
      else if (activeUnlocks.length)
        advice = { kind: 'first', label: '優先完成', text: `建議本輪優先完成：${codesText(activeUnlocks)} 需要它先完成才能接續。` };
    }
    plans.set(x.id, { order, chainSp, chain, waitFor, unlocks, advice });
  });
  return plans;
}

/** 各成員已分配的 Story Points（規劃草稿 TaskDraft；正式任務加延續任務請用 planLoad） */
export function loadByMember(members: Member[], tasks: TaskDraft[]): Record<string, number> {
  const load: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  tasks.forEach((t) => {
    if (t.assigneeId && !t.deferred) load[t.assigneeId] = (load[t.assigneeId] ?? 0) + t.storyPoints;
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

/* ---------- Sprint 容量與延續 ---------- */

/** 本次 Capacity：Sprint 建立時直接預估的點數，沒有設定時用成員預設值 */
export const capOf = (sprint: Pick<Sprint, 'capacity'> | undefined, member: Member) =>
  sprint?.capacity[member.id] ?? member.capacity;

export const capTotal = (sprint: Pick<Sprint, 'capacity'> | undefined, members: Member[]) =>
  sum(members.map((m) => capOf(sprint, m)));

export const isUnfinished = (t: Task) =>
  (BOARD_STATES as readonly string[]).includes(t.state) && t.state !== 'DONE';

/** 上個 Sprint 帶入任務在本輪需要的點數：Leader 重新評估的值，未評估時預設為原點數 */
export const carrySP = (t: Pick<Task, 'carryPoints' | 'storyPoints'>) => t.carryPoints ?? t.storyPoints;

export const CARRY_POINTS_MAX = 40;

/** 帶入任務在下個 Sprint 的負責人（有改派時用改派對象） */
export const carryOwner = (t: Pick<Task, 'carryAssigneeId' | 'assigneeId'>) => t.carryAssigneeId ?? t.assigneeId;

/** 需要確認帶入／延後決定的成員：帶入給新負責人確認，延後給目前負責人確認 */
export const carryConfirmer = (t: Pick<Task, 'carry' | 'carryAssigneeId' | 'assigneeId'>) =>
  t.carry === false ? t.assigneeId : carryOwner(t);

/** 帶入任務佔用下個 Sprint 的點數（依改派後的負責人，只計已決定帶入的任務） */
export function carryLoad(members: Member[], carryTasks: Task[]) {
  const load: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  carryTasks.forEach((t) => {
    const owner = carryOwner(t);
    if (t.carry === true && load[owner] != null) load[owner] += carrySP(t);
  });
  return load;
}

/** 規劃中 Sprint 的每人負載 = 本次正式任務點數 + 帶入任務的本輪預估點數（草稿階段請用 loadByMember） */
export function planLoad(members: Member[], planTasks: Task[], carryTasks: Task[], excludeIds: string[] = []) {
  const load = carryLoad(members, carryTasks);
  planTasks.forEach((t) => {
    const cur = load[t.assigneeId];
    if (t.state === 'DEFERRED' || !t.assigneeId || excludeIds.includes(t.id) || cur == null) return;
    load[t.assigneeId] = cur + t.storyPoints;
  });
  return load;
}

/* ---------- 核准前檢查 ---------- */

/** 核准前必須補齊的欄位 */
export function taskProblems(t: Task): string[] {
  const out: string[] = [];
  if (!t.assigneeId) out.push('沒有負責人');
  if (!t.acceptanceCriteria.length) out.push('沒有驗收條件');
  if (t.policy.mode === 'target' && !t.policy.targets.length) out.push('指定審查但未選人員');
  return out;
}

/* ---------- 協商退回 ---------- */

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

/** 會議紀錄中系統自動帶入的延續事項區塊標題 */
export const CARRY_HEADER = '## 延續事項（系統自動帶入）';

const backlogLine = (b: BacklogItem) =>
  b.kind === 'multi' ? `- [跨 Sprint] ${b.text}（自 ${b.fromSprint} 延續）` : `- [延後] ${b.text}（${b.fromSprint} 延後）`;

/** 「納入本輪」的延續事項寫進會議紀錄的區塊；帶入的未完成任務直接以原任務延續，不寫進會議紀錄以免重複拆解 */
export const carryBlock = (items: BacklogItem[]) => (items.length ? [CARRY_HEADER, ...items.map(backlogLine)].join('\n') : '');

/** 以新的延續事項區塊取代會議紀錄中原本的區塊（區塊固定放在最後） */
export function replaceCarryBlock(minutes: string, block: string) {
  const idx = minutes.indexOf(CARRY_HEADER);
  const body = (idx >= 0 ? minutes.slice(0, idx) : minutes).trimEnd();
  if (!block) return body;
  return body ? `${body}\n\n${block}` : block;
}

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
