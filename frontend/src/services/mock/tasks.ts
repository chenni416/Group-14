import {
  carryTasks,
  createTaskRecord,
  db,
  findMember,
  findSprint,
  findTask,
  leader,
  notify,
  nowIso,
  planningSprint,
  planTasks,
  prevSprintId,
  requireLead,
  resolveNotifications,
  sessionUser,
  sprintTasks,
  toTask,
  uid,
  type TaskRecord,
} from '@/mocks/db';
import { buildPrompt } from '@/mocks/handlers/prompt';
import { aiReply } from '@/mocks/handlers/chat';
import { decompose } from '@/mocks/handlers/decompose';
import { pickRank, plannedLoad, rankFor, reasonFor, suggestAll } from '@/mocks/handlers/assign';
import { aiCheck } from '@/mocks/handlers/acceptance';
import { canReview, sendToReview } from '@/mocks/handlers/review';
import { analyzeDependencies, carryOverText, findQuestions } from '@/mocks/handlers/sprint';
import { formatSize } from '@/mocks/handlers/knowledge';
import { SAMPLE_MINUTES } from '@/mocks/data/knowledge';
import {
  addDays,
  capOf,
  changesSinceReturn,
  deferSuggestions,
  isUnfinished,
  monthDay,
  preflight,
  snapshotOf,
  taskProblems,
  workdayLabels,
} from '@/lib/planning';
import { ApiError, BOARD_STATES, EDITABLE_PLAN_STATES, type BurndownPoint, type ChatMessage, type Sprint } from '@/types';
import type {
  ReviewItemsInput,
  NotificationService,
  PlanningService,
  SprintService,
  StudioService,
  TaskService,
} from '../contracts';
import { respond } from './utils';

const me = () => sessionUser();
const nameOf = (id: string) => db.members.find((m) => m.id === id)?.name ?? '未指派';

/** 規劃中 Sprint 的完整脈絡，供核准前檢查與容量建議使用 */
function planContext(sprint: Sprint) {
  return {
    sprint,
    members: db.members,
    planTasks: planTasks(sprint.id),
    carryTasks: carryTasks(sprint.id),
    dependencies: analyzeDependencies(sprint.id),
  };
}

function deferTask(task: TaskRecord, fromSprint: string, text = task.title) {
  task.prevState = task.state;
  task.state = 'DEFERRED';
  resolveNotifications(task.id, ['returned', 'invite']);
  db.backlog.push({ id: `b${uid()}`, text, fromSprint, kind: 'deferred', taskId: task.id, usedInSprintId: null });
}

/** G2：延後或調整時通知受影響的負責人，請他同意或提出異議 */
function askPlanConfirm(task: TaskRecord, what: string) {
  if (!task.assigneeId || task.assigneeId === me().id) return;
  notify(task.assigneeId, 'plan', task.id, me().id, `${task.id} ${task.title} 將${what}，請同意或提出異議`);
}

/** G5：記錄驗收決策與逐條判斷（沿用 AI 的判斷與證據，Reviewer 調整的部分覆蓋） */
function recordAcceptance(task: TaskRecord, decision: 'approved' | 'changes', reason: string, items: ReviewItemsInput | undefined) {
  const check = aiCheck(toTask(task));
  db.records.push({
    id: `ar-${uid()}`,
    taskId: task.id,
    items: check.items.map((it, i) => ({ ...it, reviewer: items?.[i]?.reviewer ?? null, note: items?.[i]?.note ?? '' })),
    decision,
    reason,
    reviewerId: me().id,
    at: nowIso(),
  });
}

export const tasks: TaskService = {
  list: () => respond(() => db.tasks.map(toTask)),

  create: (input) =>
    respond(() => {
      requireLead('新增任務');
      const sprint = planningSprint();
      if (input.assigneeId) findMember(input.assigneeId);
      if (!input.title.trim()) throw new ApiError('請輸入標題');
      const record = createTaskRecord(db.project, {
        id: `${db.project.prefix}-${db.seq++}`,
        sprintId: sprint.id,
        title: input.title.trim(),
        domain: input.domain,
        storyPoints: input.storyPoints,
        storyPointsReason: input.storyPointsReason.trim(),
        assigneeId: input.assigneeId,
        state: 'DRAFT',
        origin: 'human',
        epic: '手動任務',
        story: 'Leader 新增',
        source: input.source.trim(),
        description: input.source.trim() ? `會議紀錄：「${input.source.trim()}」` : '',
        policy: { ...input.policy, targets: input.policy.mode === 'target' ? [...input.policy.targets] : [] },
      });
      // 允許空白，交給核准前檢查（createTaskRecord 會自動補預設驗收條件）
      record.acceptanceCriteria = input.acceptanceCriteria;
      db.tasks.push(record);
      return toTask(record);
    }),

  update: (id, patch) =>
    respond(() => {
      requireLead('調整任務');
      if (patch.assigneeId) findMember(patch.assigneeId);
      const task = findTask(id);
      if (!EDITABLE_PLAN_STATES.includes(task.state)) throw new ApiError('只有草稿或協商退回的任務可以編輯');
      if (patch.policy) patch.policy = { ...patch.policy, targets: patch.policy.mode === 'target' ? [...patch.policy.targets] : [] };
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
      const sprint = planningSprint();
      const check = preflight(planContext(sprint));
      if (check.blocked) throw new ApiError('核准前檢查未通過：請先處理超量、缺少欄位或待釐清問題', 422, 'PREFLIGHT_FAILED');
      check.drafts.forEach((t) => {
        const record = findTask(t.id);
        record.state = 'PENDING_MEMBER';
        notify(record.assigneeId, 'invite', record.id, me().id, `預估 ${record.storyPoints} 點，請確認是否接受`);
      });
      sprint.step = 4;
      return { count: check.drafts.length };
    }),

  defer: (id) =>
    respond(() => {
      requireLead('延後任務');
      const sprint = planningSprint();
      const task = findTask(id);
      if (!EDITABLE_PLAN_STATES.includes(task.state)) throw new ApiError('只有草稿或協商退回的任務可以延後');
      deferTask(task, sprint.name);
      askPlanConfirm(task, '延後到下一個 Sprint');
      return toTask(task);
    }),

  restore: (id) =>
    respond(() => {
      requireLead('恢復任務');
      const task = findTask(id);
      task.state = task.prevState ?? (task.origin === 'human' ? 'DRAFT' : 'AI_DRAFT');
      task.prevState = null;
      db.backlog = db.backlog.filter((b) => b.taskId !== id || b.usedInSprintId != null);
      return toTask(task);
    }),

  setCarry: (id, carry) =>
    respond(() => {
      requireLead('調整延續任務');
      const task = findTask(id);
      if (!isUnfinished(task)) throw new ApiError('只有未完成的任務可以帶入或延後');
      task.carry = carry;
      if (!carry) askPlanConfirm(task, '延後到之後的 Sprint');
      return toTask(task);
    }),

  resend: (id) =>
    respond(() => {
      requireLead('重新發送');
      const sprint = planningSprint();
      const task = findTask(id);
      if (task.state !== 'RETURNED') throw new ApiError('這個任務不在協商退回狀態');
      const problems = taskProblems(task);
      if (problems.length) throw new ApiError(`${task.id}：${problems.join('、')}`);
      const member = findMember(task.assigneeId);
      if ((plannedLoad(sprint.id)[member.id] ?? 0) > capOf(sprint, member))
        throw new ApiError(`${member.name} 超過點數上限，請調整點數或改派`);
      const changes = changesSinceReturn(task, nameOf);
      const same = task.assigneeId === task.negotiation?.byId;
      if (same && !changes.length) throw new ApiError('請先調整內容（例如點數、驗收條件）再發送給同一位成員');
      resolveNotifications(id, ['returned']);
      task.state = 'PENDING_MEMBER';
      task.negotiation = null;
      task.returnSnapshot = null;
      notify(
        task.assigneeId,
        'invite',
        id,
        me().id,
        `${same ? '已依你的協商調整後重新指派' : `預估 ${task.storyPoints} 點（重新指派）`}${changes.length ? `：${changes.join('、')}` : ''}，請確認是否接受`,
      );
      return { task: toTask(task), changes };
    }),

  suggestAssignee: (id) =>
    respond(() => {
      requireLead('重新建議負責人');
      const sprint = planningSprint();
      const task = findTask(id);
      const by = task.negotiation?.byId;
      const ranks = rankFor(task, plannedLoad(sprint.id, [task]), sprint.id).filter((r) => r.member.id !== by);
      const fits = ranks.some((r) => r.remain >= task.storyPoints);
      const best = pickRank(ranks, task.storyPoints, true);
      if (!best) throw new ApiError('沒有可指派的成員');
      Object.assign(task, {
        assigneeId: best.member.id,
        suggestedAssigneeId: best.member.id,
        edited: true,
        suggestReason:
          `${reasonFor(best)}（已排除提出協商的 ${by ? nameOf(by) : '成員'}）` +
          (fits ? '' : `。目前沒有成員有 ${task.storyPoints} SP 的剩餘點數，需調低點數、延後此任務，或調整其他任務`),
      });
      return { task: toTask(task), fits };
    }),

  resetReturn: (id) =>
    respond(() => {
      requireLead('復原修改');
      const task = findTask(id);
      const snap = task.returnSnapshot;
      if (!snap) throw new ApiError('沒有可復原的內容');
      Object.assign(task, {
        title: snap.title,
        acceptanceCriteria: [...snap.acceptanceCriteria],
        storyPoints: snap.storyPoints,
        storyPointsReason: snap.storyPointsReason,
        assigneeId: snap.assigneeId,
        policy: { ...snap.policy, targets: [...snap.policy.targets] },
      });
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
      task.negotiation = { byId: me().id, reason: input.reason.trim(), suggestId: input.suggestId, target: input.target };
      task.returnSnapshot = snapshotOf(task);
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

  submitForReview: (id, delivery) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId !== me().id) throw new ApiError('只有負責人可以送審', 403);
      if (delivery && !delivery.prUrl.trim()) throw new ApiError('請填寫 PR 連結');
      sendToReview(task, delivery?.prUrl);
      if (delivery) task.delivery = { ...delivery, prUrl: delivery.prUrl.trim(), submittedAt: nowIso() };
      return toTask(task);
    }),

  approveReview: (id, items) =>
    respond(() => {
      const task = findTask(id);
      const user = me();
      if (!canReview(task, user.id)) throw new ApiError('你目前不是這項任務的審查者', 403);
      recordAcceptance(task, 'approved', '', items);
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

  requestChanges: (id, note, items) =>
    respond(() => {
      if (!note.trim()) throw new ApiError('要求修改時請填寫意見');
      const task = findTask(id);
      if (!canReview(task, me().id)) throw new ApiError('你目前不是這項任務的審查者', 403);
      recordAcceptance(task, 'changes', note.trim(), items);
      Object.assign(task, { state: 'IN_PROGRESS', reviewerId: null, claimedAt: null, approvals: [] });
      resolveNotifications(id, ['review', 'pool']);
      notify(task.assigneeId, 'info', id, me().id, `要求修改：${note.trim()}`);
      return toTask(task);
    }),

  confirmPlan: (id, status, note) =>
    respond(() => {
      const task = findTask(id);
      if (task.assigneeId !== me().id) throw new ApiError('只有被影響的負責人可以回覆', 403);
      if (status === 'object' && !note.trim()) throw new ApiError('提出異議時請填寫原因');
      task.planConfirms.push({ memberId: me().id, status, note: note.trim(), at: nowIso() });
      resolveNotifications(id, ['plan']);
      notify(leader().id, 'info', id, me().id, status === 'agree' ? '同意延後或調整' : `對延後或調整提出異議：${note.trim()}`);
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

  defaults: () =>
    respond(() => {
      const last = [...db.sprints].sort((a, b) => b.id - a.id)[0]!;
      const startDate = addDays(last.endDate, 1);
      const carry = carryOverText(last.id);
      return {
        id: last.id + 1,
        name: `Sprint ${last.id + 1}`,
        startDate,
        endDate: addDays(startDate, 13),
        capacity: Object.fromEntries(db.members.map((m) => [m.id, m.capacity])),
        minutes: carry.text,
        carryCount: carry.count,
      };
    }, 80),

  create: (input) =>
    respond(() => {
      requireLead('建立 Sprint');
      if (db.project.planningSprintId != null) throw new ApiError('已經有規劃中的 Sprint，請先完成或啟動它');
      if (!input.name.trim()) throw new ApiError('請輸入 Sprint 名稱');
      if (!input.startDate || !input.endDate || input.endDate < input.startDate) throw new ApiError('請確認起訖日期');
      const id = Math.max(...db.sprints.map((s) => s.id)) + 1;
      const sprint: Sprint = {
        id,
        name: input.name.trim(),
        start: monthDay(input.startDate),
        end: monthDay(input.endDate),
        startDate: input.startDate,
        endDate: input.endDate,
        goal: input.goal.trim(),
        status: 'planning',
        capacity: Object.fromEntries(Object.entries(input.capacity).map(([k, v]) => [k, Math.max(0, Math.round(v))])),
        minutes: input.minutes,
        docs: [...input.docs],
        questions: null,
        step: 1,
        summary: null,
      };
      db.sprints.push(sprint);
      db.project.planningSprintId = id;
      // 已寫進會議紀錄的延續事項，標記為已帶入
      if (/\[(延後|跨 Sprint)\]/.test(input.minutes))
        db.backlog.forEach((b) => {
          if (b.usedInSprintId == null) b.usedInSprintId = id;
        });
      return sprint;
    }),

  update: (id, patch) =>
    respond(() => {
      requireLead('修改 Sprint');
      const sprint = findSprint(id);
      if (patch.goal != null) sprint.goal = patch.goal;
      if (patch.minutes != null) sprint.minutes = patch.minutes;
      return sprint;
    }, 80),

  addDocs: (id, files) =>
    respond(() => {
      requireLead('上傳文件');
      const sprint = findSprint(id);
      sprint.docs.push(...files.map((f) => ({ name: f.name, size: formatSize(f.size) })));
      return sprint;
    }),

  analyze: (id, minutes) =>
    respond(() => {
      requireLead('分析會議紀錄');
      if (!minutes.trim()) throw new ApiError('請先貼上會議紀錄');
      const sprint = findSprint(id);
      sprint.minutes = minutes;
      sprint.questions = findQuestions(minutes, sprint.questions);
      return { unanswered: sprint.questions.filter((q) => !q.answer).length };
    }, 600),

  answer: (id, questionId, answer) =>
    respond(() => {
      requireLead('回答待釐清問題');
      const q = findSprint(id).questions?.find((x) => x.id === questionId);
      if (!q) throw new ApiError('找不到這個問題', 404);
      q.answer = answer.trim();
      return findSprint(id);
    }, 60),

  start: (id) =>
    respond(() => {
      if (me().role !== 'Leader') throw new ApiError('只有 Leader 可以啟動 Sprint', 403);
      const next = planTasks(id);
      if (!next.length || !next.every((t) => t.state === 'ASSIGNED')) throw new ApiError('仍有任務未被成員接受');
      const prevId = prevSprintId(id);
      let carriedOver = 0;
      let deferred = 0;
      if (prevId != null) {
        const prev = findSprint(prevId);
        const all = sprintTasks(prevId).filter((t) => t.state !== 'DEFERRED');
        prev.summary = {
          total: all.reduce((a, t) => a + t.storyPoints, 0),
          done: all.filter((t) => t.state === 'DONE').reduce((a, t) => a + t.storyPoints, 0),
          tasks: all.length,
        };
        sprintTasks(prevId)
          .filter(isUnfinished)
          .forEach((t) => {
            if (t.carry) {
              t.sprintId = id;
              carriedOver++;
            } else {
              deferTask(t, prev.name, `${t.id} ${t.title}`);
              deferred++;
            }
          });
        prev.status = 'closed';
      }
      // 同一個 Sprint 內的相依性寫進任務，看板才能顯示「等待 TL-xxx」
      analyzeDependencies(id)
        .filter((d) => d.scope === 'same')
        .forEach((d) => {
          const t = findTask(d.taskId);
          if (!t.dependsOn.includes(d.dependsOnId)) t.dependsOn.push(d.dependsOnId);
        });
      next.forEach((t) => (t.state = 'TODO'));
      const sprint = findSprint(id);
      sprint.status = 'active';
      sprint.step = 4;
      db.project.activeSprintId = id;
      db.project.planningSprintId = null;
      return { carriedOver, deferred };
    }),

  end: (id) =>
    respond(() => {
      requireLead('結束 Sprint');
      const sprint = findSprint(id);
      if (sprint.status !== 'active') throw new ApiError('只有進行中的 Sprint 可以結束');
      const all = sprintTasks(id).filter((t) => t.state !== 'DEFERRED');
      sprint.summary = {
        total: all.reduce((a, t) => a + t.storyPoints, 0),
        done: all.filter((t) => t.state === 'DONE').reduce((a, t) => a + t.storyPoints, 0),
        tasks: all.length,
      };
      sprint.status = 'closed';
      if (!db.retros.some((r) => r.sprintId === id)) db.retros.push({ sprintId: id, status: 'open', entries: [], actions: [] });
      return { unfinished: sprintTasks(id).filter(isUnfinished).length };
    }),

  burndown: (id) =>
    respond((): BurndownPoint[] => {
      const board = sprintTasks(id).filter((t) => (BOARD_STATES as readonly string[]).includes(t.state));
      const total = board.reduce((a, t) => a + t.storyPoints, 0);
      const done = board.filter((t) => t.state === 'DONE').reduce((a, t) => a + t.storyPoints, 0);
      const sprint = findSprint(id);
      const labels =
        id === 2
          ? ['10/27', '10/28', '10/29', '10/30', '10/31', '11/03', '11/04', '11/05', '11/06', '11/09']
          : workdayLabels(sprint.startDate, 10);
      const n = labels.length;
      const history = id === 2 ? [29, 29, 28, 28, 27, 26, 26, 25, 24].map((v) => Math.max(total - done, Math.round((v * total) / 29))) : [];
      const actual = [...history, total - done];
      return labels.map((label, i) => ({
        label,
        ideal: +(total * (1 - i / (n - 1))).toFixed(1),
        actual: actual[i] ?? null,
      }));
    }),

  backlog: () => respond(() => db.backlog, 80),

  removeBacklog: (id) =>
    respond(() => {
      requireLead('移除延續事項');
      db.backlog = db.backlog.filter((b) => b.id !== id);
    }),

  dependencies: (id) => respond(() => analyzeDependencies(id), 120),
};

export const planning: PlanningService = {
  getSampleMinutes: () => respond(() => SAMPLE_MINUTES, 60),
  decompose: (sprintId) =>
    respond(() => {
      requireLead('執行 AI 拆解');
      const sprint = findSprint(sprintId);
      if (!sprint.minutes.trim()) throw new ApiError('請先貼上會議紀錄');
      if (sprint.questions == null) throw new ApiError('請先按「AI 分析會議紀錄」');
      if (sprint.questions.some((q) => !q.answer)) throw new ApiError('還有待釐清問題未回答，無法分配任務');
      const created = decompose(sprintId);
      sprint.step = Math.max(sprint.step, 3) as Sprint['step'];
      return { created };
    }, 2000),

  deferSuggested: (sprintId) =>
    respond(() => {
      requireLead('延後任務');
      const sprint = findSprint(sprintId);
      const list = deferSuggestions(planContext(sprint));
      list.forEach((t) => deferTask(findTask(t.id), sprint.name));
      return { deferred: list.length };
    }),

  rebalance: (sprintId) =>
    respond(() => {
      requireLead('重新平衡指派');
      const list = planTasks(sprintId).filter((t) => t.state === 'AI_DRAFT' && !t.edited);
      suggestAll(list, sprintId, true);
      return { updated: list.length };
    }),
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
