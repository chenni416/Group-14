import type {
  ChatMessage,
  KnowledgeDoc,
  Member,
  Notification,
  NotificationType,
  Organization,
  Project,
  Sprint,
  Task,
} from '@/types';
import { ApiError } from '@/types';
import { DOMAIN_TAGS, GENERIC_AC, SAMPLE_MINUTES } from './data/knowledge';
import { seedMembers } from './data/members';
import { NOTIFICATION_SEEDS, TASK_SEEDS } from './data/tasks';
import { seedDocs, seedOrg, seedProject, seedSprints } from './data/workspace';

/** Mock 資料庫中的任務：在 Task 之外多存 Prompt 版本與對話紀錄 */
export interface TaskRecord extends Task {
  /** 每個 Prompt 版本累積的「補充釐清」條目 */
  clarifications: string[][];
  promptCursor: number;
  chat: ChatMessage[];
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
  notes: string;
  seq: number;
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
  const num = init.id.split('-')[1] ?? '0';
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
    branch: project.branchPattern
      .replace('{prefix}', project.prefix.toLowerCase())
      .replace('{id}', num)
      .replace('{slug}', slug),
    negotiation: null,
    clarifications: [[]],
    promptCursor: 0,
    chat: [],
    ...rest,
  };
  if (!task.acceptanceCriteria.length) task.acceptanceCriteria = ['成果與會議決議一致', ...GENERIC_AC[task.domain]];
  if (!task.tags.length) task.tags = [...DOMAIN_TAGS[task.domain]];
  if (!task.description) task.description = `${task.title}。詳細規格見 PRD 對應章節。`;
  return task;
}

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
      pr: s.pr ?? null,
    }),
  );
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
  return {
    sessionUserId: 'm1',
    org: seedOrg(),
    project,
    members: seedMembers(),
    sprints: seedSprints(),
    docs: seedDocs(),
    tasks,
    notifications,
    notes: SAMPLE_MINUTES,
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
export const isLeadRole = (m: Member) => m.role === 'Leader' || m.role === 'PO';
export const sprintTasks = (sprintId: number) => db.tasks.filter((t) => t.sprintId === sprintId);

export function requireLead(action: string) {
  if (!isLeadRole(sessionUser())) throw new ApiError(`只有 Leader / PO 可以${action}`, 403, 'FORBIDDEN');
}

export function notify(toId: string, type: NotificationType, taskId: string, fromId: string, text: string) {
  db.notifications.unshift({ id: uid(), toId, type, taskId, fromId, text, createdAt: nowIso(), status: 'pending' });
}

export function resolveNotifications(taskId: string, types: NotificationType[]) {
  db.notifications.forEach((n) => {
    if (n.taskId === taskId && types.includes(n.type) && n.status === 'pending') n.status = 'done';
  });
}

export function toTask(record: TaskRecord): Task {
  const { clarifications: _c, promptCursor: _p, chat: _h, ...task } = record;
  return clone(task);
}
