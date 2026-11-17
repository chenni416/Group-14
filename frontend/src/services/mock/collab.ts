import {
  db,
  findMember,
  findSprint,
  findTask,
  isLeadRole,
  leader,
  notify,
  nowIso,
  requireLead,
  sessionUser,
  toTask,
  uid,
} from '@/mocks/db';
import { aiCheck } from '@/mocks/handlers/acceptance';
import { buildPlan } from '@/mocks/handlers/execution';
import { recommendOwner } from '@/mocks/handlers/issues';
import { ApiError, type ExecutionPlan, type Issue, type Proposal, type Retro, type Task } from '@/types';
import type { AcceptanceService, ExecutionService, IssueService, ProposalService, RetroService } from '../contracts';
import { respond } from './utils';

const me = () => sessionUser();

/** 完成某個問題或提案後，把對應的待辦通知標示為已處理 */
function resolveRef(refId: string) {
  db.notifications.forEach((n) => {
    if (n.refId === refId && n.status === 'pending') n.status = 'done';
  });
}

/* ---------- G3：執行計畫 ---------- */

const PLAN_STATES = ['ASSIGNED', 'TODO', 'IN_PROGRESS'];

function ownedTask(taskId: string) {
  const task = findTask(taskId);
  if (task.assigneeId !== me().id) throw new ApiError('只有負責人可以建立或調整執行計畫', 403, 'FORBIDDEN');
  return task;
}

function planOf(taskId: string): ExecutionPlan | undefined {
  return db.plans.find((p) => p.taskId === taskId);
}

export const execution: ExecutionService = {
  list: () => respond(() => db.plans),
  get: (taskId) => respond(() => planOf(taskId) ?? null),

  suggest: (taskId) =>
    respond(() => {
      const task = ownedTask(taskId);
      if (!PLAN_STATES.includes(task.state)) throw new ApiError('任務接受後、完成前才能建立執行計畫');
      if (planOf(taskId)?.confirmedAt) throw new ApiError('已確認的計畫請直接編輯，不需要重新產生');
      const taskMap = new Map<string, Task>(db.tasks.map((t) => [t.id, toTask(t)]));
      const plan = buildPlan(toTask(task), findSprint(task.sprintId), { taskMap, docs: db.docs });
      db.plans = [...db.plans.filter((p) => p.taskId !== taskId), plan];
      return plan;
    }),

  save: (taskId, input) =>
    respond(() => {
      const task = ownedTask(taskId);
      const current = planOf(taskId);
      if (!current && !PLAN_STATES.includes(task.state)) throw new ApiError('任務接受後、完成前才能建立執行計畫');
      if (input.checklist.some((c) => !c.text.trim())) throw new ApiError('Checklist 項目不能是空白');
      if (input.checkpoints.some((c) => !c.title.trim())) throw new ApiError('Checkpoint 需要名稱');
      const plan: ExecutionPlan = current ?? {
        taskId,
        checklist: [],
        checkpoints: [],
        depChecks: [],
        origin: 'human',
        edited: false,
        confirmedAt: null,
      };
      Object.assign(plan, {
        checklist: input.checklist.map((c) => ({ ...c, text: c.text.trim() })),
        checkpoints: input.checkpoints.map((c) => ({ ...c, title: c.title.trim() })),
        depChecks: input.depChecks.map((c) => ({ ...c, text: c.text.trim() })),
        edited: plan.origin === 'ai' ? true : plan.edited,
      });
      if (!current) db.plans.push(plan);
      return plan;
    }),

  confirm: (taskId) =>
    respond(() => {
      ownedTask(taskId);
      const plan = planOf(taskId);
      if (!plan || !plan.checklist.length) throw new ApiError('請先建立至少一個 Checklist 項目');
      plan.confirmedAt = nowIso();
      return plan;
    }),

  toggleItem: (taskId, itemId) =>
    respond(() => {
      ownedTask(taskId);
      const item = planOf(taskId)?.checklist.find((c) => c.id === itemId);
      if (!item) throw new ApiError('找不到 Checklist 項目', 404, 'NOT_FOUND');
      item.done = !item.done;
      return planOf(taskId)!;
    }),

  toggleCheckpoint: (taskId, checkpointId) =>
    respond(() => {
      ownedTask(taskId);
      const cp = planOf(taskId)?.checkpoints.find((c) => c.id === checkpointId);
      if (!cp) throw new ApiError('找不到 Checkpoint', 404, 'NOT_FOUND');
      cp.reachedAt = cp.reachedAt ? null : nowIso();
      return planOf(taskId)!;
    }),
};

/* ---------- G4：問題回報 ---------- */

function findIssue(id: string): Issue {
  const issue = db.issues.find((i) => i.id === id);
  if (!issue) throw new ApiError(`找不到問題 ${id}`, 404, 'NOT_FOUND');
  return issue;
}

export const issues: IssueService = {
  list: () => respond(() => [...db.issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  report: (input) =>
    respond(() => {
      const task = findTask(input.taskId);
      if (!input.description.trim()) throw new ApiError('請描述遇到的問題');
      const user = me();
      const rec = recommendOwner(
        { type: input.type, taskId: input.taskId },
        { tasks: db.tasks.map(toTask), members: db.members, sprint: findSprint(task.sprintId), reporterId: user.id },
      );
      if (input.preferOwnerId) findMember(input.preferOwnerId);
      const ownerId = input.preferOwnerId ?? rec.ownerId;
      const now = nowIso();
      const issue: Issue = {
        id: `IS-${db.issues.length + 1}`,
        taskId: input.taskId,
        type: input.type,
        description: input.description.trim(),
        reporterId: user.id,
        ownerId,
        suggestedOwnerId: rec.ownerId,
        ownerReason: input.preferOwnerId && input.preferOwnerId !== rec.ownerId ? `回報者指定；系統推薦：${rec.reason}` : rec.reason,
        status: 'assigned',
        responses: [],
        createdAt: now,
        updatedAt: now,
        sprintId: task.sprintId,
      };
      db.issues.push(issue);
      notify(ownerId, 'issue', task.id, user.id, `請你協助處理：${issue.description}`, issue.id);
      const lead = leader();
      if (lead.id !== ownerId && lead.id !== user.id) {
        notify(lead.id, 'issue', task.id, user.id, `新問題已指派給 ${findMember(ownerId).name}，可改派：${issue.description}`, issue.id);
      }
      return issue;
    }),

  assign: (id, ownerId) =>
    respond(() => {
      requireLead('指派問題處理人');
      const issue = findIssue(id);
      if (issue.status === 'resolved' || issue.status === 'replan') throw new ApiError('這個問題已經結案');
      findMember(ownerId);
      issue.ownerId = ownerId;
      issue.status = 'assigned';
      issue.updatedAt = nowIso();
      resolveRef(id);
      notify(ownerId, 'issue', issue.taskId, me().id, `請你協助處理：${issue.description}`, issue.id);
      return issue;
    }),

  respond: (id, text) =>
    respond(() => {
      const issue = findIssue(id);
      const user = me();
      if (issue.ownerId !== user.id && !isLeadRole(user)) throw new ApiError('只有處理人或 Leader 可以回應', 403, 'FORBIDDEN');
      if (!text.trim()) throw new ApiError('請填寫回應內容');
      if (issue.status === 'resolved' || issue.status === 'replan') throw new ApiError('這個問題已經結案');
      issue.responses.push({ id: `r-${uid()}`, byId: user.id, text: text.trim(), at: nowIso() });
      issue.status = 'responded';
      issue.updatedAt = nowIso();
      resolveRef(id);
      notify(issue.reporterId, 'issue', issue.taskId, user.id, `你回報的問題已回應：${text.trim()}`, issue.id);
      return issue;
    }),

  resolve: (id) =>
    respond(() => {
      const issue = findIssue(id);
      const user = me();
      if (issue.reporterId !== user.id && !isLeadRole(user)) throw new ApiError('只有回報者或 Leader 可以確認解決', 403, 'FORBIDDEN');
      issue.status = 'resolved';
      issue.updatedAt = nowIso();
      resolveRef(id);
      return issue;
    }),

  replan: (id) =>
    respond(() => {
      const issue = findIssue(id);
      const user = me();
      if (issue.reporterId !== user.id && !isLeadRole(user)) throw new ApiError('只有回報者或 Leader 可以要求重新規劃', 403, 'FORBIDDEN');
      issue.status = 'replan';
      issue.updatedAt = nowIso();
      resolveRef(id);
      const lead = leader();
      if (lead.id !== user.id) notify(lead.id, 'issue', issue.taskId, user.id, `需要重新規劃：${issue.description}`, issue.id);
      return issue;
    }),
};

/* ---------- G4：提案 ---------- */

function findProposal(id: string): Proposal {
  const p = db.proposals.find((x) => x.id === id);
  if (!p) throw new ApiError(`找不到提案 ${id}`, 404, 'NOT_FOUND');
  return p;
}

export const proposals: ProposalService = {
  list: () => respond(() => [...db.proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),

  create: (input) =>
    respond(() => {
      if (!input.title.trim()) throw new ApiError('請輸入提案標題');
      if (input.taskId) findTask(input.taskId);
      const user = me();
      const proposal: Proposal = {
        id: `PP-${db.proposals.length + 1}`,
        title: input.title.trim(),
        description: input.description.trim(),
        kind: input.kind,
        authorId: user.id,
        taskId: input.taskId,
        status: 'open',
        decision: '',
        decidedById: null,
        comments: [],
        createdAt: nowIso(),
        sprintId: db.project.activeSprintId,
      };
      db.proposals.push(proposal);
      db.members
        .filter((m) => isLeadRole(m) && m.id !== user.id)
        .forEach((m) => notify(m.id, 'proposal', input.taskId ?? '', user.id, `新提案待決策：${proposal.title}`, proposal.id));
      return proposal;
    }),

  comment: (id, text) =>
    respond(() => {
      const proposal = findProposal(id);
      if (!text.trim()) throw new ApiError('請輸入留言');
      proposal.comments.push({ id: `c-${uid()}`, byId: me().id, text: text.trim(), at: nowIso() });
      return proposal;
    }),

  decide: (id, input) =>
    respond(() => {
      requireLead('決策提案');
      const proposal = findProposal(id);
      if (proposal.status !== 'open') throw new ApiError('這個提案已經決策');
      if (!input.reason.trim()) throw new ApiError('請填寫決策理由');
      proposal.status = input.decision;
      proposal.decision = input.reason.trim();
      proposal.decidedById = me().id;
      resolveRef(id);
      if (input.decision === 'nextSprint') {
        db.backlog.push({
          id: `b${uid()}`,
          text: `提案「${proposal.title}」`,
          fromSprint: findSprint(proposal.sprintId).name,
          kind: 'deferred',
          taskId: null,
          usedInSprintId: null,
        });
      }
      if (proposal.authorId !== me().id) {
        notify(proposal.authorId, 'info', proposal.taskId ?? '', me().id, `你的提案「${proposal.title}」已決策：${input.reason.trim()}`, proposal.id);
      }
      return proposal;
    }),
};

/* ---------- G5：驗收 ---------- */

export const acceptance: AcceptanceService = {
  check: (taskId) => respond(() => aiCheck(toTask(findTask(taskId))), 500),
  records: (taskId) => respond(() => db.records.filter((r) => r.taskId === taskId).sort((a, b) => b.at.localeCompare(a.at))),
};

/* ---------- G7：回顧 ---------- */

function retroOf(sprintId: number): Retro {
  findSprint(sprintId);
  let retro = db.retros.find((r) => r.sprintId === sprintId);
  if (!retro) {
    retro = { sprintId, status: 'open', entries: [], actions: [] };
    db.retros.push(retro);
  }
  return retro;
}

function openRetro(sprintId: number): Retro {
  const retro = retroOf(sprintId);
  if (retro.status === 'closed') throw new ApiError('這份回顧已經結束，內容唯讀');
  return retro;
}

export const retros: RetroService = {
  get: (sprintId) => respond(() => retroOf(sprintId)),
  list: () => respond(() => db.retros),

  submitEntry: (sprintId, input) =>
    respond(() => {
      const retro = openRetro(sprintId);
      if (![input.well, input.hard, input.improve].some((t) => t.trim())) throw new ApiError('至少填寫一個欄位');
      const entry = { id: `e-${uid()}`, byId: me().id, well: input.well.trim(), hard: input.hard.trim(), improve: input.improve.trim() };
      retro.entries = [...retro.entries.filter((e) => e.byId !== me().id), entry];
      return retro;
    }),

  addAction: (sprintId, input) =>
    respond(() => {
      const retro = openRetro(sprintId);
      if (!input.text.trim()) throw new ApiError('請輸入改善行動');
      findMember(input.ownerId);
      retro.actions.push({ id: `a-${uid()}`, text: input.text.trim(), ownerId: input.ownerId, done: false, fromSprintId: sprintId, usedInSprintId: null });
      return retro;
    }),

  toggleAction: (sprintId, actionId) =>
    respond(() => {
      const retro = retroOf(sprintId);
      const action = retro.actions.find((a) => a.id === actionId);
      if (!action) throw new ApiError('找不到改善行動', 404, 'NOT_FOUND');
      const user = me();
      if (action.ownerId !== user.id && !isLeadRole(user)) throw new ApiError('只有負責人或 Leader 可以更新', 403, 'FORBIDDEN');
      action.done = !action.done;
      return retro;
    }),

  close: (sprintId) =>
    respond(() => {
      requireLead('結束回顧');
      const retro = openRetro(sprintId);
      retro.status = 'closed';
      return retro;
    }),
};
