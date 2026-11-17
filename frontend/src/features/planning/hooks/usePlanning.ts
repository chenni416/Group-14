import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type {
  CreateTaskInput,
  GenerateDraftInput,
  GenerateTasksInput,
  PlanningDraft,
  ReviseTaskInput,
  UpdateSprintInput,
  UpdateTaskInput,
} from '@/types';
import { usePlanningStore } from '../store';

export const DECOMPOSE_KEY = ['planning', 'decompose'];
export const ANALYZE_KEY = ['planning', 'analyze'];

/**
 * 規劃中 Sprint 的會議紀錄。依 Sprint 區分快取，建立新 Sprint 後會讀到新的紀錄；
 * 不跟著 ['sprints'] 失效，避免覆蓋輸入框中尚未送出的內容。
 */
export const useMinutes = (sprintId?: number) =>
  useQuery({ queryKey: ['planning', 'minutes', sprintId], queryFn: api.planning.getMinutes, staleTime: Infinity });

export function usePlanningMutations() {
  const navigate = useNavigate();
  const { loadDraft, appendTasks, setStage, reset } = usePlanningStore();

  /* ---- 規劃草稿（Planning Studio） ---- */
  const generate = useApiMutation({
    mutationFn: (input: GenerateDraftInput) => api.planning.generateDraft(input),
    invalidate: [['sprints']],
    onSuccess: (draft) => {
      loadDraft(draft);
      toast(`AI 切分出 ${draft.stories.length} 個 Story，請確認範疇與預估點數`);
    },
  });

  const generateTasks = useApiMutation({
    mutationKey: ['planning', 'generate-tasks'],
    mutationFn: (input: GenerateTasksInput) => api.planning.generateTasks(input),
    invalidate: [['sprints']],
    onSuccess: (tasks, input) => {
      appendTasks(tasks);
      setStage('tasks');
      toast(`已依 ${input.stories.length} 個 Story 拆解出 ${tasks.length} 張 Task，全部進入未指派`);
    },
  });

  const submit = useApiMutation({
    mutationFn: (draft: PlanningDraft) => api.planning.submitPlan(draft),
    onSuccess: ({ count }) => {
      reset();
      toast(`已確認派工並通知成員（共 ${count} 張任務），進入確認與認領`);
      navigate('/inbox');
    },
  });

  const revise = useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviseTaskInput }) => api.tasks.revise(id, input),
    onSuccess: (t) => toast(`已更新 ${t.id} 並重新發送通知，任務回到待確認`),
  });

  const updateGoal = useApiMutation({
    mutationFn: ({ id, goal }: { id: number; goal: string }) => api.sprints.update(id, { goal }),
    invalidate: [['sprints']],
  });

  /* ---- ① 輸入 ---- */
  const updateSprint = useApiMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UpdateSprintInput }) => api.sprints.update(id, patch),
    invalidate: [['sprints']],
  });
  const addDocs = useApiMutation({
    mutationFn: ({ id, files }: { id: number; files: File[] }) =>
      api.sprints.addDocs(id, files.map((f) => ({ name: f.name, size: f.size }))),
    invalidate: [['sprints']],
    onSuccess: (_s, { files }) => toast(`已加入 ${files.length} 份文件`),
  });
  const analyze = useApiMutation({
    mutationKey: ANALYZE_KEY,
    mutationFn: ({ id, minutes }: { id: number; minutes: string }) => api.sprints.analyze(id, minutes),
    invalidate: [['sprints']],
  });
  const answer = useApiMutation({
    mutationFn: ({ id, questionId, answer }: { id: number; questionId: string; answer: string }) =>
      api.sprints.answer(id, questionId, answer),
    invalidate: [['sprints']],
  });

  /* ---- ② AI 拆解 ---- */
  const decompose = useApiMutation({
    mutationKey: DECOMPOSE_KEY,
    mutationFn: (sprintId: number) => api.planning.decompose(sprintId),
    onSuccess: ({ created }) => toast(created ? `AI 拆解出 ${created} 項任務，請審核調整後核准` : '沒有偵測到新的待辦項目'),
  });

  /* ---- ③ 審核調整 ---- */
  const updateTask = useApiMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTaskInput }) => api.tasks.update(id, patch),
    invalidate: [['tasks'], ['sprints']],
  });
  const removeTask = useApiMutation({ mutationFn: api.tasks.remove });
  const createTask = useApiMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    onSuccess: (t) => toast(`已新增 ${t.id}`),
  });
  const deferTask = useApiMutation({
    mutationFn: api.tasks.defer,
    onSuccess: (t) => toast(`${t.id} 已延後，下次建立 Sprint 時會自動帶入會議紀錄`),
  });
  const restoreTask = useApiMutation({ mutationFn: api.tasks.restore });
  const setCarry = useApiMutation({
    mutationFn: ({ id, carry }: { id: string; carry: boolean }) => api.tasks.setCarry(id, carry),
  });
  const deferSuggested = useApiMutation({
    mutationFn: (sprintId: number) => api.planning.deferSuggested(sprintId),
    onSuccess: ({ deferred }) => toast(`已延後 ${deferred} 項任務，並記錄到延續事項`),
  });
  const rebalance = useApiMutation({
    mutationFn: (sprintId: number) => api.planning.rebalance(sprintId),
    onSuccess: ({ updated }) => toast(`已重新平衡 ${updated} 項 AI 草稿的指派`),
  });

  /* ---- 協商退回 ---- */
  const resend = useApiMutation({
    mutationFn: api.tasks.resend,
    onSuccess: ({ task, changes }) =>
      toast(changes.length ? `已調整並重新發送 ${task.id}` : `已重新發送 ${task.id} 的指派邀請`),
  });
  const suggestAssignee = useApiMutation({
    mutationFn: api.tasks.suggestAssignee,
    onSuccess: ({ fits }) =>
      toast(fits ? 'AI 已重新建議負責人' : '沒有成員有足夠的剩餘點數，建議調低點數或延後此任務'),
  });
  const resetReturn = useApiMutation({ mutationFn: api.tasks.resetReturn });

  /* ---- ④ 核准發送 ---- */
  const approveDrafts = useApiMutation({
    mutationFn: () => api.tasks.approveDrafts(),
    onSuccess: ({ count }) => toast(`已核准 ${count} 項任務並發送指派邀請`),
  });

  return {
    generate,
    generateTasks,
    submit,
    revise,
    updateGoal,
    updateSprint,
    addDocs,
    analyze,
    answer,
    decompose,
    updateTask,
    removeTask,
    createTask,
    deferTask,
    restoreTask,
    setCarry,
    deferSuggested,
    rebalance,
    resend,
    suggestAssignee,
    resetReturn,
    approveDrafts,
  };
}
