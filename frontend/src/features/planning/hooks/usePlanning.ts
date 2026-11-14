import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { CreateTaskInput, UpdateSprintInput, UpdateTaskInput } from '@/types';

export const DECOMPOSE_KEY = ['planning', 'decompose'];
export const ANALYZE_KEY = ['planning', 'analyze'];

export function usePlanningMutations() {
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
