import type {
  AcceptanceRecord,
  BacklogItem,
  ChatMessage,
  ExecutionPlan,
  Issue,
  KnowledgeDoc,
  Member,
  Notification,
  NotificationType,
  Organization,
  Project,
  Proposal,
  Retro,
  Sprint,
  Task,
  TaskComment,
} from '@/types';
import { ApiError } from '@/types';
import { isUnfinished } from '@/lib/planning';
import { seedComments, seedIssues, seedProposals, seedRetros } from './data/collab';
import { enrichPr, makeDelivery } from './data/delivery';
import { DOMAIN_TAGS, GENERIC_AC } from './data/knowledge';
import { seedMembers } from './data/members';
import { NOTIFICATION_SEEDS, TASK_SEEDS } from './data/tasks';
import { seedBacklog, seedDocs, seedOrg, seedProject, seedSprints } from './data/workspace';
import { buildPlan } from './handlers/execution';

/** Mock 資料庫中的任務：在 Task 之外多存 Prompt 版本與對話紀錄 */
export interface TaskRecord extends Task {
  /** 每個 Prompt 版本累積的「補充釐清」條目 */
  clarifications: string[][];
  promptCursor: number;
  chat: ChatMessage[];
  /** 從延續事項恢復的任務，重新拆解時保留 */
  revived: boolean;
}

export interface MockDb {
  sessionUserId: string;
  org: Organization;
  project: Project;
  members: Member[];
  sprints: Sprint[];
  docs: KnowledgeDoc[];
  tasks: TaskRecord[];
  notifications: Notification[];
  backlog: BacklogItem[];
  /** G3：每項任務最多一份執行計畫 */
  plans: ExecutionPlan[];
  /** G4：問題與提案 */
  issues: Issue[];
  proposals: Proposal[];
  /** 任務留言區 */
  comments: TaskComment[];
  /** G5：驗收紀錄（每次驗收決策一筆） */
  records: AcceptanceRecord[];
  /** G7：每個 Sprint 一份回顧 */
  retros: Retro[];
  seq: number;
}

/**
 * 不屬於任何 Story 的任務編號（手動新增、舊版自動拆解）：Story 序號用 0，例如 S-301、S-302。
 * 與規劃流程的 S-{Sprint}{Story}{Task} 同一套規則，分支數字也相同。
 */
export function looseTaskId(sprintId: number): string {
  const used = new Set(db.tasks.map((t) => t.id));
  let n = 1;
  while (used.has(`S-${sprintId}0${n}`)) n++;
  return `S-${sprintId}0${n}`;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const nowIso = () => new Date().toISOString();
export const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

/** 模擬網路延遲 */
export const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

export const clone = <T>(value: T): T => structuredClone(value);

type TaskInit = Pick<TaskRecord, 'id' | 'title' | 'domain' | 'storyPoints' | 'assigneeId' | 'state'> &
  Partial<TaskRecord> & { slug?: string };

export function createTaskRecord(project: Project, init: TaskInit): TaskRecord {
  const { slug = 'task', ...rest } = init;
  const task: TaskRecord = {
    sprintId: project.activeSprintId,
    description: '',
    tags: [],
    storyPointsReason: '',
    acceptanceCriteria: [],
    epic: '',
    story: '',
    origin: 'ai',
    edited: false,
    suggestedAssigneeId: null,
    suggestReason: '',
    policy: { mode: 'pool', targets: [], rule: 'any' },
    policyReason: '',
    reviewerId: null,
    approvals: [],
    claimedAt: null,
    reviewStartedAt: null,
    pr: null,
    // 分支與任務編號同一組數字：S-212 ↔ feat/S212-…
    branch: `${init.domain === 'QA' ? 'test' : 'feat'}/S${init.id.replace(/^S-/, '')}-${slug}`,
    negotiation: null,
    source: '',
    carryTag: null,
    multiSprint: false,
    clarified: false,
    carry: null,
    carryAssigneeId: null,
    carryPoints: null,
    carryStatus: null,
    dependsOn: [],
    returnSnapshot: null,
    prevState: null,
    scope: '',
    outOfScope: '',
    responsibility: '',
    deliverables: [],
    planConfirms: [],
    delivery: null,
    revived: false,
    clarifications: [[]],
    promptCursor: 0,
    chat: [],
    ...rest,
  };
  if (!task.acceptanceCriteria.length) task.acceptanceCriteria = ['成果與會議決議一致', ...GENERIC_AC[task.domain]];
  if (!task.tags.length) task.tags = [...DOMAIN_TAGS[task.domain]];
  if (!task.description) task.description = `${task.title}。詳細規格見 PRD 對應章節。`;
  if (!task.scope) task.scope = `完成「${task.title}」，並通過上列驗收條件。`;
  if (!task.outOfScope) task.outOfScope = '不包含規格以外的新需求；有新想法請走提案。';
  if (!task.responsibility) task.responsibility = '負責實作、更新執行計畫進度，遇到阻礙時回報問題。';
  if (!task.deliverables.length) task.deliverables = [`${task.title} 的實作（PR）`, '對應的測試或驗證紀錄'];
  return task;
}

/** 種子任務的前置任務（G2），格式與規劃時標註的相依相同 */
const SEED_DEPENDS: Record<string, { id: string; reason: string }[]> = {
  'S-222': [{ id: 'S-213', reason: '推薦理由要檢索知識庫中的成員技能資料，需要索引 Pipeline 先完成' }],
  'S-243': [{ id: 'S-241', reason: 'E2E 登入流程需要 GitHub OAuth 登入先完成' }],
};

/** 種子任務送審時附帶的「未完成項目」與「待確認問題」，讓驗收畫面展示這些欄位 */
const SEED_DELIVERY_EXTRA: Record<string, { unfinished?: string; questions?: string }> = {
  'S-231': { unfinished: '深色模式的配色尚未處理', questions: '空狀態插圖是否需要設計稿確認？' },
};

function seed(): MockDb {
  const project = seedProject();
  const tasks = TASK_SEEDS.map((s) =>
    createTaskRecord(project, {
      id: s.id,
      title: s.title,
      domain: s.domain,
      storyPoints: s.storyPoints,
      assigneeId: s.assigneeId,
      suggestedAssigneeId: s.assigneeId,
      state: s.state,
      slug: s.slug,
      epic: 'Sprint 2',
      policy: { ...s.policy, targets: [...s.policy.targets] },
      policyReason: s.policyReason ?? '',
      reviewerId: s.reviewerId ?? null,
      approvals: s.approvals ?? [],
      claimedAt: s.claimedHoursAgo != null ? hoursAgo(s.claimedHoursAgo) : null,
      reviewStartedAt: s.reviewHoursAgo != null ? hoursAgo(s.reviewHoursAgo) : null,
      pr: s.pr ? enrichPr({ id: s.id, domain: s.domain, title: s.title }, s.pr) : null,
      dependsOn: SEED_DEPENDS[s.id] ?? [],
    }),
  );
  // 已送審或完成的任務附上 mock 的交付內容，驗收畫面才有資料
  tasks.forEach((t) => {
    if (!t.pr) return;
    t.delivery = makeDelivery(t, hoursAgo(t.state === 'DONE' ? 72 : 6), SEED_DELIVERY_EXTRA[t.id]);
  });
  const sprints = seedSprints();
  const docs = seedDocs();
  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  // 進行中的任務已有確認過的執行計畫（部分完成）；TODO 任務沒有，可體驗「讓 AI 建議」
  const plans = tasks
    .filter((t) => t.state === 'IN_PROGRESS')
    .map((t, i) => {
      const plan = buildPlan(t, sprints[1]!, { taskMap, docs });
      plan.confirmedAt = hoursAgo(30);
      plan.checklist.slice(0, 2 + i).forEach((c) => (c.done = true));
      plan.checkpoints[0]!.reachedAt = hoursAgo(20);
      return plan;
    });
  const notifications: Notification[] = NOTIFICATION_SEEDS.map((n) => ({
    id: uid(),
    toId: n.toId,
    fromId: n.fromId,
    type: n.type,
    taskId: n.taskId,
    text: n.text,
    createdAt: hoursAgo(n.hoursAgo),
    status: n.status ?? 'pending',
  }));
  const issues = seedIssues();
  const proposals = seedProposals();
  // 種子問題與提案的通知（問題通知處理人；待決策提案通知 Leader）
  const extra = (n: Omit<Notification, 'id' | 'status' | 'createdAt'> & { hoursAgo: number }): Notification => ({
    id: uid(),
    toId: n.toId,
    fromId: n.fromId,
    type: n.type,
    taskId: n.taskId,
    refId: n.refId,
    text: n.text,
    createdAt: hoursAgo(n.hoursAgo),
    status: 'pending',
  });
  notifications.push(
    extra({ toId: 'm3', fromId: 'm2', type: 'issue', taskId: 'S-222', refId: 'IS-1', text: '請你協助處理：指派推薦需要成員負載資料', hoursAgo: 30 }),
    extra({ toId: 'm1', fromId: 'm3', type: 'issue', taskId: 'S-213', refId: 'IS-3', text: '問題待指派：索引大型文件耗時過長', hoursAgo: 5 }),
    extra({ toId: 'm1', fromId: 'm2', type: 'mention', taskId: 'S-222', text: '想確認負載資料要不要包含已延後的任務？', hoursAgo: 3 }),
    extra({ toId: 'm1', fromId: 'm4', type: 'proposal', taskId: '', refId: 'PP-1', text: '新提案待決策：Review 通知同步寄送 Email', hoursAgo: 26 }),
  );
  return {
    sessionUserId: 'm1',
    org: seedOrg(),
    project,
    members: seedMembers(),
    sprints,
    docs,
    tasks,
    notifications,
    backlog: seedBacklog(),
    plans,
    issues,
    proposals,
    comments: seedComments(),
    records: [],
    retros: seedRetros(),
    seq: 301,
  };
}

export const db: MockDb = seed();

/* ---------- 查詢輔助 ---------- */

export function findMember(id: string): Member {
  const m = db.members.find((x) => x.id === id);
  if (!m) throw new ApiError(`找不到成員 ${id}`, 404, 'NOT_FOUND');
  return m;
}

export function findTask(id: string): TaskRecord {
  const t = db.tasks.find((x) => x.id === id);
  if (!t) throw new ApiError(`找不到任務 ${id}`, 404, 'NOT_FOUND');
  return t;
}

export function findSprint(id: number): Sprint {
  const s = db.sprints.find((x) => x.id === id);
  if (!s) throw new ApiError(`找不到 Sprint ${id}`, 404, 'NOT_FOUND');
  return s;
}

export const sessionUser = () => findMember(db.sessionUserId);
export const leader = () => db.members.find((m) => m.role === 'Leader') ?? db.members[0]!;
export const isLeadRole = (m: Member) => m.role === 'Leader';
export const sprintTasks = (sprintId: number) => db.tasks.filter((t) => t.sprintId === sprintId);

/** 目前規劃中的 Sprint；沒有時丟出錯誤 */
export function planningSprint(): Sprint {
  const id = db.project.planningSprintId;
  if (id == null) throw new ApiError('目前沒有規劃中的 Sprint，請先建立 Sprint', 400, 'NO_PLANNING_SPRINT');
  return findSprint(id);
}

export const prevSprintId = (id: number) =>
  db.sprints
    .map((s) => s.id)
    .filter((x) => x < id)
    .sort((a, b) => b - a)[0] ?? null;

/** 規劃中 Sprint 的任務（不含延後與已上看板的帶入任務） */
export const planTasks = (sprintId: number) =>
  sprintTasks(sprintId).filter((t) => t.state !== 'DEFERRED' && !['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(t.state));

/** 上一個 Sprint 尚未完成、可能帶入本次的任務 */
export function carryTasks(sprintId: number) {
  const prev = prevSprintId(sprintId);
  return prev == null ? [] : sprintTasks(prev).filter(isUnfinished);
}

export function requireLead(action: string) {
  if (!isLeadRole(sessionUser())) throw new ApiError(`只有 Leader 可以${action}`, 403, 'FORBIDDEN');
}

export function notify(toId: string, type: NotificationType, taskId: string, fromId: string, text: string, refId?: string) {
  db.notifications.unshift({ id: uid(), toId, type, taskId, refId, fromId, text, createdAt: nowIso(), status: 'pending' });
}

export function resolveNotifications(taskId: string, types: NotificationType[]) {
  db.notifications.forEach((n) => {
    if (n.taskId === taskId && types.includes(n.type) && n.status === 'pending') n.status = 'done';
  });
}

export function toTask(record: TaskRecord): Task {
  const { clarifications: _c, promptCursor: _p, chat: _h, revived: _r, ...task } = record;
  return clone(task);
}
