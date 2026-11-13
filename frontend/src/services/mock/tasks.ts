import {
  createTaskRecord,
  db,
  findMember,
  findSprint,
  findTask,
  leader,
  notify,
  nowIso,
  requireLead,
  resolveNotifications,
  sessionUser,
  sprintTasks,
  toTask,
} from '@/mocks/db';
import { buildPrompt } from '@/mocks/handlers/prompt';
import { aiReply } from '@/mocks/handlers/chat';
import { decompose } from '@/mocks/handlers/decompose';
import { canReview, sendToReview } from '@/mocks/handlers/review';
import { SAMPLE_MINUTES } from '@/mocks/data/knowledge';
import { ApiError, BOARD_STATES, type BurndownPoint, type ChatMessage } from '@/types';
import type {
  NotificationService,
  PlanningService,
  SprintService,
  StudioService,
  TaskService,
} from '../contracts';
import { respond } from './utils';

const me = () => sessionUser();
const isDraft = (state: string) => state === 'AI_DRAFT' || state === 'DRAFT';

export const tasks: TaskService = {
  list: () => respond(() => db.tasks.map(toTask)),

  create: (input) =>
    respond(() => {
      requireLead('新增任務');
      findMember(input.assigneeId);
      if (!input.title.trim()) throw new ApiError('請輸入標題');
      const def = db.project.defaultPolicy;
      const record = createTaskRecord(db.project, {
        id: `${db.project.prefix}-${db.seq++}`,
        sprintId: db.project.planningSprintId,
        title: input.title.trim(),
        domain: input.domain,
        storyPoints: input.storyPoints,
        assigneeId: input.assigneeId,
        acceptanceCriteria: input.acceptanceCriteria,
        state: 'DRAFT',
        origin: 'human',
        epic: '手動任務',
        story: 'Leader 新增',
        policy: { ...def, targets: [...def.targets] },
        policyReason: '沿用專案預設策略',
      });
      db.tasks.push(record);
      return toTask(record);
    }),

  update: (id, patch) =>
    respond(() => {
      requireLead('調整任務');
      if (patch.assigneeId) findMember(patch.assigneeId);
      const task = findTask(id);
      if (!isDraft(task.state)) throw new ApiError('只有草稿可以編輯');
      Object.assign(task, patch, { edited: true });
      return toTask(task);
    }),

  remove: (id) =>
    respond(() => {
      requireLead('移除任務');
      db.tasks = db.tasks.filter((t) => t.id !== id);
    }),

  approveDrafts: () =>
    respond(() => {
      requireLead('核准任務');
      const drafts = sprintTasks(db.project.planningSprintId).filter((t) => isDraft(t.state));
      drafts.forEach((t) => {
        t.state = 'PENDING_MEMBER';
        notify(t.assigneeId, 'invite', t.id, me().id, `預估 ${t.storyPoints} 點，請確認是否接受`);
      });
      return { count: drafts.length };
    }),

  reassign: (id, assigneeId) =>
    respond(() => {
      requireLead('重新指派');
      findMember(assigneeId);
      const task = findTask(id);
      resolveNotifications(id, ['returned']);
      Object.assign(task, { assigneeId, edited: true, state: 'PENDING_MEMBER', negotiation: null });
      notify(assigneeId, 'invite', id, me().id, `預估 ${task.storyPoints} 點（重新指派），請確認是否接受`);
      return toTask(task);
    }),

  accept: (id) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId !== me().id) throw new ApiError('只有被指派的成員可以接受', 403);
      task.state = 'ASSIGNED';
      resolveNotifications(id, ['invite']);
      notify(leader().id, 'info', id, me().id, '已接受任務指派');
      return toTask(task);
    }),

  negotiate: (id, input) =>
    respond(() => {
      if (!input.reason.trim()) throw new ApiError('請填寫原因');
      const task = findTask(id);
      task.state = 'RETURNED';
      task.negotiation = { byId: me().id, reason: input.reason.trim(), suggestId: input.suggestId };
      resolveNotifications(id, ['invite']);
      notify(leader().id, 'returned', id, me().id, input.reason.trim());
      return toTask(task);
    }),

  claimReview: (id) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId === me().id) throw new ApiError('不能審查自己的任務', 403);
      if (task.reviewerId) throw new ApiError('已被其他成員認領', 409, 'CONFLICT');
      task.reviewerId = me().id;
      task.claimedAt = nowIso();
      resolveNotifications(id, ['pool']);
      return toTask(task);
    }),

  startDevelopment: (id) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId !== me().id) throw new ApiError('只有負責人可以開始開發', 403);
      task.state = 'IN_PROGRESS';
      return toTask(task);
    }),

  submitForReview: (id) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId !== me().id) throw new ApiError('只有負責人可以送審', 403);
      sendToReview(task);
      return toTask(task);
    }),

  approveReview: (id) =>
    respond(() => {
      const task = findTask(id);
      const user = me();
      if (!canReview(task, user.id)) throw new ApiError('你目前不是這項任務的審查者', 403);
      const { policy } = task;
      if (policy.mode === 'target') {
        task.approvals.push(user.id);
        db.notifications.forEach((n) => {
          if (n.taskId === id && n.toId === user.id && n.status === 'pending') n.status = 'done';
        });
        if (policy.rule === 'all' && task.approvals.length < policy.targets.length) {
          return { completed: false, approvals: task.approvals.length, required: policy.targets.length };
        }
      }
      task.state = 'DONE';
      if (task.pr) task.pr.status = 'merged';
      resolveNotifications(id, ['review', 'pool']);
      notify(task.assigneeId, 'info', id, user.id, '審查通過，任務已完成');
      return { completed: true, approvals: task.approvals.length, required: policy.targets.length };
    }),

  requestChanges: (id, note) =>
    respond(() => {
      if (!note.trim()) throw new ApiError('要求修改時請填寫意見');
      const task = findTask(id);
      if (!canReview(task, me().id)) throw new ApiError('你目前不是這項任務的審查者', 403);
      Object.assign(task, { state: 'IN_PROGRESS', reviewerId: null, claimedAt: null, approvals: [] });
      resolveNotifications(id, ['review', 'pool']);
      notify(task.assigneeId, 'info', id, me().id, `要求修改：${note.trim()}`);
      return toTask(task);
    }),

  updatePolicy: (id, policy) =>
    respond(() => {
      const task = findTask(id);
      const user = me();
      const lead = user.role === 'Leader' || user.role === 'PO';
      if (!lead && task.assigneeId !== user.id) throw new ApiError('只有 Leader / PO 或負責人可以調整', 403);
      if (task.state === 'IN_REVIEW' || task.state === 'DONE') throw new ApiError('審查中已鎖定');
      task.policy = { ...policy, targets: policy.mode === 'target' ? [...policy.targets] : [] };
      task.policyReason = '';
      return toTask(task);
    }),
};

export const sprints: SprintService = {
  list: () => respond(() => db.sprints),

  updateGoal: (id, goal) =>
    respond(() => {
      requireLead('修改 Sprint Goal');
      const sprint = findSprint(id);
      sprint.goal = goal;
      return sprint;
    }),

  start: (id) =>
    respond(() => {
      if (me().role !== 'Leader') throw new ApiError('只有 Leader 可以啟動 Sprint', 403);
      const next = sprintTasks(id);
      if (!next.length || !next.every((t) => t.state === 'ASSIGNED')) throw new ApiError('仍有任務未被成員接受');
      const prevId = db.project.activeSprintId;
      const carry = sprintTasks(prevId).filter((t) => t.state !== 'DONE');
      carry.forEach((t) => (t.sprintId = id));
      sprintTasks(id).forEach((t) => {
        if (t.state === 'ASSIGNED') t.state = 'TODO';
      });
      findSprint(prevId).status = 'closed';
      findSprint(id).status = 'active';
      db.project.activeSprintId = id;
      return { carriedOver: carry.length };
    }),

  burndown: (id) =>
    respond((): BurndownPoint[] => {
      const board = sprintTasks(id).filter((t) => (BOARD_STATES as readonly string[]).includes(t.state));
      const total = board.reduce((a, t) => a + t.storyPoints, 0);
      const done = board.filter((t) => t.state === 'DONE').reduce((a, t) => a + t.storyPoints, 0);
      const labels =
        id === 2
          ? ['10/27', '10/28', '10/29', '10/30', '10/31', '11/03', '11/04', '11/05', '11/06', '11/09']
          : ['11/10', '11/11', '11/12', '11/13', '11/14', '11/17', '11/18', '11/19', '11/20', '11/21'];
      const n = labels.length;
      const history = id === 2 ? [29, 29, 28, 28, 27, 26, 26, 25, 24].map((v) => Math.max(total - done, Math.round((v * total) / 29))) : [];
      const actual = [...history, total - done];
      return labels.map((label, i) => ({
        label,
        ideal: +(total * (1 - i / (n - 1))).toFixed(1),
        actual: actual[i] ?? null,
      }));
    }),
};

export const planning: PlanningService = {
  getMinutes: () => respond(() => db.notes, 60),
  getSampleMinutes: () => respond(() => SAMPLE_MINUTES, 60),
  decompose: (minutes) =>
    respond(() => {
      requireLead('執行 AI 拆解');
      if (!minutes.trim()) throw new ApiError('請先貼上會議紀錄');
      db.notes = minutes;
      return { created: decompose(minutes) };
    }, 2000),
};

export const notifications: NotificationService = {
  list: () => respond(() => db.notifications.filter((n) => n.toId === db.sessionUserId)),
};

function ensureGreeting(taskId: string) {
  const task = findTask(taskId);
  if (!task.chat.length) {
    task.chat.push({
      id: 'greeting',
      role: 'assistant',
      text: `我已讀取 ${task.id} 的規格、${findSprint(task.sprintId).name} 目標與 ${db.docs.length} 份專案文件。有任何需要釐清的地方都可以直接問，不用重打背景；我會把結論更新到左側的 Prompt。`,
      sources: ['PRD_v2.md', 'openapi.yaml'],
    });
  }
  return task;
}

const promptState = (taskId: string) => {
  const task = findTask(taskId);
  return { versions: task.clarifications.map((_, v) => buildPrompt(task, v)), current: task.promptCursor };
};

export const studio: StudioService = {
  getPrompt: (taskId) => respond(() => promptState(taskId), 60),
  setPromptVersion: (taskId, version) =>
    respond(() => {
      const task = findTask(taskId);
      task.promptCursor = Math.max(0, Math.min(task.clarifications.length - 1, version));
      return promptState(taskId);
    }, 60),
  getChat: (taskId) => respond(() => ensureGreeting(taskId).chat, 60),
  ask: (taskId, question) =>
    respond((): ChatMessage => {
      const task = ensureGreeting(taskId);
      task.chat.push({ id: `${Date.now()}-u`, role: 'user', text: question });
      const reply = aiReply(task, question);
      const current = task.clarifications[task.promptCursor] ?? [];
      if (!current.includes(reply.addition)) {
        task.clarifications = [...task.clarifications.slice(0, task.promptCursor + 1), [...current, reply.addition]];
        task.promptCursor = task.clarifications.length - 1;
      }
      const message: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        text: reply.answer,
        sources: reply.sources,
        promptAddition: reply.addition,
        promptVersion: task.promptCursor + 1,
      };
      task.chat.push(message);
      return message;
    }, 750),
};
