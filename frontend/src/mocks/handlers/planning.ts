import type { Domain, GenerateTasksInput, PlanningDraft, ReviewPolicy, ReviewerAssignment, StoryDraft, TaskDraft } from '@/types';
import { ApiError } from '@/types';
import { SCENARIO_STORIES, SCENARIO_TASKS, SIMULATED_RESPONSES } from '../data/planningScenario';
import { branchName, carryConfirmer, carrySP, dependencyIssues, storyCode, taskCode } from '@/lib/planning';
import {
  carryTasks,
  createTaskRecord,
  db,
  findMember,
  leader,
  notify,
  planningSprint,
  resolveNotifications,
  sessionUser,
  sprintTasks,
  type TaskRecord,
  uid,
} from '../db';

/** 回傳預設 Mock 場景的 Story 切分（不解析會議紀錄內容）；此時尚未拆解 Task */
export function generateDraft(goal: string): PlanningDraft {
  const sprint = planningSprint();
  if (goal.trim()) sprint.goal = goal.trim();
  else if (!sprint.goal) sprint.goal = '讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制';

  return {
    sprintId: sprint.id,
    stories: SCENARIO_STORIES.map((s, i) => ({ ...s, no: i + 1, code: storyCode(sprint.id, i + 1) })),
    tasks: [],
  };
}

const toPolicy = (r: ReviewerAssignment): ReviewPolicy =>
  r.mode === 'member' && r.memberId
    ? { mode: 'target', targets: [r.memberId], rule: 'any' }
    : { mode: r.mode === 'leader' ? 'leader' : 'pool', targets: [], rule: 'any' };

/** 核准規劃：草稿轉為正式任務（待成員確認）並發送指派邀請 */
export function submitPlan(input: PlanningDraft): number {
  if (sprintTasks(input.sprintId).length) throw new ApiError('本 Sprint 已送出規劃，不能重複核准', 409, 'CONFLICT');
  // 延後的項目留在草稿中標註，送出時不派工、改寫進延續事項
  const deferredStories = input.stories.filter((s) => s.deferred);
  const deferredTasks = input.tasks.filter((t) => t.deferred);
  const draft = { ...input, stories: input.stories.filter((s) => !s.deferred), tasks: input.tasks.filter((t) => !t.deferred) };
  const unassigned = draft.tasks.filter((t) => !t.assigneeId);
  if (unassigned.length) throw new ApiError(`還有 ${unassigned.length} 張 Task 尚未指派負責人`);
  const carried = carryTasks(draft.sprintId);
  const undecided = carried.filter((t) => t.carry == null);
  if (undecided.length) throw new ApiError(`上輪還有 ${undecided.length} 項未完成任務尚未決定帶入或延後`);
  const blocking = dependencyIssues(input, carried).filter((i) => i.level === 'blocking');
  if (blocking[0]) throw new ApiError(`${blocking[0].text}，請先一起延後或移除相依`);
  const taken = draft.tasks.find((t) => db.tasks.some((x) => x.id === t.code));
  if (taken) throw new ApiError(`任務編號 ${taken.code} 已被使用`, 409, 'CONFLICT');

  const me = sessionUser();
  const created = new Map<string, TaskRecord>();
  // 草稿 id → 正式任務編號；上輪帶入任務的 id 本身就是正式編號
  const idOf = new Map(draft.tasks.map((t) => [t.id, t.code]));
  const carriedIds = new Set(carried.map((t) => t.id));
  draft.tasks.forEach((t) => {
    const assigneeId = findMember(t.assigneeId!).id;
    const story = draft.stories.find((s) => s.id === t.storyId);
    const record = createTaskRecord(db.project, {
      id: t.code,
      dependsOn: t.dependsOn
        .map((d) => ({ id: idOf.get(d.id) ?? (carriedIds.has(d.id) ? d.id : ''), reason: d.reason }))
        .filter((d) => d.id),
      sprintId: draft.sprintId,
      title: t.title,
      domain: t.domain,
      storyPoints: t.storyPoints,
      acceptanceCriteria: t.acceptanceCriteria,
      epic: story ? `${story.code} ${story.title}` : '',
      story: story?.userStory ?? '',
      origin: 'ai',
      edited: t.assigneeId !== t.suggestedAssigneeId,
      state: 'PENDING_MEMBER',
      assigneeId,
      suggestedAssigneeId: t.suggestedAssigneeId,
      suggestReason: t.assignReason,
      policy: toPolicy(t.reviewer),
      description: t.analysis,
      branch: branchName(t),
    });
    db.tasks.push(record);
    created.set(t.id, record);
    notify(assigneeId, 'invite', record.id, me.id, `預估 ${t.storyPoints} 點，請確認是否接受`);
  });
  recordDeferred(draft.sprintId, deferredStories, deferredTasks);
  simulateMemberResponses(created);
  dispatchCarry(carried);
  return draft.tasks.length;
}

/** 本輪延後的 Story／Task 寫進延續事項：延後的 Story 一筆（含其 Task），個別延後的 Task 各一筆 */
function recordDeferred(sprintId: number, stories: StoryDraft[], tasks: TaskDraft[]) {
  const sprint = db.sprints.find((s) => s.id === sprintId);
  const from = sprint?.name ?? `Sprint ${sprintId}`;
  const storyIds = new Set(stories.map((s) => s.id));
  stories.forEach((s) => {
    const count = tasks.filter((t) => t.storyId === s.id).length;
    db.backlog.push({
      id: `b${uid()}`,
      text: `${s.code} ${s.title}${count ? `（${count} 張 Task）` : ''}`,
      fromSprint: from,
      kind: 'deferred',
      taskId: null,
      usedInSprintId: null,
      decision: null,
    });
  });
  tasks
    .filter((t) => !storyIds.has(t.storyId))
    .forEach((t) =>
      db.backlog.push({ id: `b${uid()}`, text: `${t.code} ${t.title}`, fromSprint: from, kind: 'deferred', taskId: null, usedInSprintId: null, decision: null }),
    );
}

/**
 * 上輪未完成任務的帶入／延後決定一起發送給成員確認：帶入給（改派後的）負責人、延後給目前負責人。
 * 決定送出後鎖定，只有成員協商退回時 Leader 才能修改。
 * 示範用：Leader 自己的直接確認；第一項帶入給其他成員的任務模擬協商退回，其餘模擬已接受。
 */
function dispatchCarry(list: TaskRecord[]) {
  const me = sessionUser();
  const lead = leader();
  const returnId = list.find((t) => t.carry && carryConfirmer(t) !== me.id)?.id;
  list.forEach((t) => {
    const to = carryConfirmer(t);
    t.carryStatus = 'pending';
    notify(
      to,
      'invite',
      t.id,
      me.id,
      t.carry ? `上輪未完成，Leader 評估本輪需要 ${carrySP(t)} 點完成，將帶入下個 Sprint，請確認是否接受` : '上輪未完成，Leader 決定延後到之後的 Sprint，請確認',
    );
    if (to !== me.id && t.id === returnId) {
      const reason = '這輪要支援 Demo 準備，剩下的部分希望改派給其他成員或延後';
      t.carryStatus = 'returned';
      t.negotiation = { byId: to, reason, suggestId: null };
      resolveNotifications(t.id, ['invite']);
      notify(lead.id, 'returned', t.id, to, reason);
      return;
    }
    t.carryStatus = 'accepted';
    resolveNotifications(t.id, ['invite']);
    if (to !== me.id) notify(lead.id, 'info', t.id, to, t.carry ? '已接受帶入下個 Sprint' : '已確認延後');
  });
}

/** 規則式模擬 Story 微調對話（僅回覆建議，不實際修改草稿） */
export function storyAssistantReply(question: string, storyTitle: string | null): string {
  const target = storyTitle ? `「${storyTitle}」` : '目前的切分';
  if (/拆|分成|太大/.test(question))
    return `${target} 可以依交付順序拆成兩個 Story：先完成後端與資料模型，再交付前端互動。拆分後每個 Story 約 5–6 SP，較容易在一週內驗收。請直接編輯左側卡片調整，確認後再進入 Task 拆解。`;
  if (/合併|併/.test(question))
    return `${target} 與相鄰 Story 的使用情境重疊度不高，合併後驗收條件會變得較分散。若要合併，建議保留兩組獨立的驗收條件，並把總點數控制在 13 SP 以內。`;
  if (/下個|移出|延後|範圍/.test(question))
    return `了解。我會把相關範疇標記為下個 Sprint 處理，${target} 的點數預估可下修約 3 SP。你可以在左側卡片移除對應的範疇項目。`;
  if (/點數|SP|估/.test(question))
    return `${target} 的點數是依各範疇的複雜度加總估算：新服務或涉及資料表變更約 3–5 SP，延伸既有元件約 1–2 SP。如果團隊對某項技術較陌生，建議上調 1–2 SP 作為緩衝。`;
  return `收到。依會議紀錄，${target} 目前的切分依據是「同一個使用情境、可獨立驗收」。如果你希望改變切分方式，可以告訴我要拆分、合併或移出哪些範疇。`;
}

const guessDomain = (text: string): Domain =>
  /測試|E2E/i.test(text) ? 'QA'
  : /設計|視覺|Figma/i.test(text) ? 'DS'
  : /AI|模型|Prompt|RAG/i.test(text) ? 'AI'
  : /API|後端|資料|webhook|服務|權限/i.test(text) ? 'BE'
  : 'FE';

/**
 * 依確認後的 Story 拆解 Task：預設場景的 Story 回傳對應的 Mock Task；
 * Leader 手動新增的 Story 依「範疇」每項拆一張（無範疇則一張）。所有 Task 皆未指派。
 */
export function generateTasks({ sprintId, stories }: GenerateTasksInput): TaskDraft[] {
  return stories.flatMap((story) => {
    const scenario = SCENARIO_TASKS.filter((t) => t.storyId === story.id);
    if (scenario.length)
      return scenario.map((t, ti) => ({ ...t, assigneeId: null, no: ti + 1, code: taskCode(sprintId, story.no, ti + 1) }));

    const items = story.scope.length ? story.scope : [story.title];
    return items.map((item, ti) => ({
      id: `${story.id}-tk-${ti + 1}`,
      storyId: story.id,
      no: ti + 1,
      code: taskCode(sprintId, story.no, ti + 1),
      title: item,
      domain: guessDomain(item),
      branchPrefix: 'feat' as const,
      branchSlug: `task-${ti + 1}`,
      storyPoints: 2,
      acceptanceCriteria: ['成果符合 Story 描述的使用情境', '通過 Code Review 與既有測試'],
      assigneeId: null,
      suggestedAssigneeId: null,
      reviewer: { mode: 'pool' as const, memberId: null },
      analysis: `依 Story「${story.title}」的範疇拆出，屬手動新增項目，尚無 AI 細部技術分析。`,
      assignReason: '手動新增的 Story 沒有 AI 指派建議，請依成員技能與負載自行指派。',
      dependsOn: [],
    }));
  });
}

/** 示範用：套用 SIMULATED_RESPONSES，部分任務直接變為「已接受」或「協商退回」 */
function simulateMemberResponses(created: Map<string, TaskRecord>) {
  const lead = leader();
  const returned = SIMULATED_RESPONSES.returned
    .map((r) => ({ ...r, record: created.get(r.taskId) }))
    .filter((r): r is typeof r & { record: TaskRecord } => !!r.record);
  // 預設任務被移除時，改由第一張待確認任務退回，確保畫面上至少有一張協商退回
  if (!returned.length) {
    const fallback = [...created.values()][0];
    const sample = SIMULATED_RESPONSES.returned[0];
    if (fallback && sample) returned.push({ ...sample, record: fallback });
  }

  returned.forEach(({ record, reason }) => {
    record.state = 'RETURNED';
    record.negotiation = { byId: record.assigneeId, reason, suggestId: null };
    resolveNotifications(record.id, ['invite']);
    notify(lead.id, 'returned', record.id, record.assigneeId, reason);
  });

  SIMULATED_RESPONSES.accepted.forEach((id) => {
    const record = created.get(id);
    if (!record || record.state !== 'PENDING_MEMBER') return;
    record.state = 'ASSIGNED';
    resolveNotifications(record.id, ['invite']);
    notify(lead.id, 'info', record.id, record.assigneeId, '已接受任務指派');
  });
}
