import type { Domain, GenerateTasksInput, PlanningDraft, ReviewPolicy, ReviewerAssignment, TaskDraft } from '@/types';
import { ApiError } from '@/types';
import { SCENARIO_STORIES, SCENARIO_TASKS, SIMULATED_RESPONSES } from '../data/planningScenario';
import { branchName } from '@/lib/planning';
import { createTaskRecord, db, findMember, findSprint, leader, notify, resolveNotifications, sessionUser, sprintTasks, type TaskRecord } from '../db';

/** 回傳預設 Mock 場景的 Story 切分（不解析會議紀錄內容）；此時尚未拆解 Task */
export function generateDraft(goal: string): PlanningDraft {
  const sprint = findSprint(db.project.planningSprintId);
  if (goal.trim()) sprint.goal = goal.trim();
  else if (!sprint.goal) sprint.goal = '讓成員能在任務內與 AI 對話微調 Prompt，並上線彈性 Review 機制';

  return {
    sprintId: sprint.id,
    stories: SCENARIO_STORIES.map((s, i) => ({ ...s, code: `S${sprint.id}-${i + 1}` })),
    tasks: [],
  };
}

const toPolicy = (r: ReviewerAssignment): ReviewPolicy =>
  r.mode === 'member' && r.memberId
    ? { mode: 'target', targets: [r.memberId], rule: 'any' }
    : { mode: r.mode === 'leader' ? 'leader' : 'pool', targets: [], rule: 'any' };

/** 核准規劃：草稿轉為正式任務（待成員確認）並發送指派邀請 */
export function submitPlan(draft: PlanningDraft): number {
  if (sprintTasks(draft.sprintId).length) throw new ApiError('本 Sprint 已送出規劃，不能重複核准', 409, 'CONFLICT');
  const unassigned = draft.tasks.filter((t) => !t.assigneeId);
  if (unassigned.length) throw new ApiError(`還有 ${unassigned.length} 張 Task 尚未指派負責人`);

  const me = sessionUser();
  const created = new Map<string, TaskRecord>();
  draft.tasks.forEach((t) => {
    const assigneeId = findMember(t.assigneeId!).id;
    const story = draft.stories.find((s) => s.id === t.storyId);
    const record = createTaskRecord(db.project, {
      id: `${db.project.prefix}-${db.seq++}`,
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
      branch: branchName(draft, t),
    });
    db.tasks.push(record);
    created.set(t.id, record);
    notify(assigneeId, 'invite', record.id, me.id, `預估 ${t.storyPoints} 點，請確認是否接受`);
  });
  simulateMemberResponses(created);
  return draft.tasks.length;
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
export function generateTasks({ stories, existingTaskCount }: GenerateTasksInput): TaskDraft[] {
  let n = db.seq + existingTaskCount;
  const code = () => `${db.project.prefix}-${n++}`;

  return stories.flatMap((story) => {
    const scenario = SCENARIO_TASKS.filter((t) => t.storyId === story.id);
    if (scenario.length) return scenario.map((t) => ({ ...t, assigneeId: null, code: code() }));

    const items = story.scope.length ? story.scope : [story.title];
    return items.map((item, ti) => ({
      id: `${story.id}-tk-${ti + 1}`,
      storyId: story.id,
      code: code(),
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
