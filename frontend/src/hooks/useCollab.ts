import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type {
  AddRetroActionInput,
  CreateProposalInput,
  DecideProposalInput,
  ReportIssueInput,
  SaveExecutionPlanInput,
  SubmitRetroEntryInput,
} from '@/types';
import { useApiMutation } from './useApiMutation';

/* ---------- 讀取 ---------- */

export const useExecutionPlans = () => useQuery({ queryKey: queryKeys.execution, queryFn: api.execution.list });
export const useIssues = () => useQuery({ queryKey: queryKeys.issues, queryFn: api.issues.list });
export const useProposals = () => useQuery({ queryKey: queryKeys.proposals, queryFn: api.proposals.list });
export const useRetros = () => useQuery({ queryKey: queryKeys.retros, queryFn: api.retros.list });

export const useRetro = (sprintId: number | undefined) =>
  useQuery({
    queryKey: sprintId == null ? ['retros', 'none'] : queryKeys.retro(sprintId),
    queryFn: () => api.retros.get(sprintId!),
    enabled: sprintId != null,
  });

export const useAcceptanceCheck = (taskId: string, enabled: boolean) =>
  useQuery({ queryKey: queryKeys.acceptanceCheck(taskId), queryFn: () => api.acceptance.check(taskId), enabled });

export const useAcceptanceRecords = (taskId: string) =>
  useQuery({ queryKey: queryKeys.acceptanceRecords(taskId), queryFn: () => api.acceptance.records(taskId) });

/* ---------- G3：執行計畫 ---------- */

export function useExecutionActions() {
  const keys = [['execution']];
  const suggest = useApiMutation({
    mutationFn: api.execution.suggest,
    invalidate: keys,
    onSuccess: () => toast('AI 已產生計畫建議，請檢查並調整後確認'),
  });
  const save = useApiMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: SaveExecutionPlanInput }) => api.execution.save(taskId, input),
    invalidate: keys,
  });
  const confirm = useApiMutation({
    mutationFn: api.execution.confirm,
    invalidate: keys,
    onSuccess: () => toast('已確認執行計畫'),
  });
  const toggleItem = useApiMutation({
    mutationFn: ({ taskId, itemId }: { taskId: string; itemId: string }) => api.execution.toggleItem(taskId, itemId),
    invalidate: keys,
  });
  const toggleCheckpoint = useApiMutation({
    mutationFn: ({ taskId, checkpointId }: { taskId: string; checkpointId: string }) => api.execution.toggleCheckpoint(taskId, checkpointId),
    invalidate: keys,
  });
  return { suggest, save, confirm, toggleItem, toggleCheckpoint };
}

/* ---------- G4：問題與提案 ---------- */

export function useIssueActions() {
  const keys = [['issues'], ['notifications']];
  const report = useApiMutation({
    mutationFn: (input: ReportIssueInput) => api.issues.report(input),
    invalidate: keys,
    onSuccess: () => toast('已回報問題，並通知處理人'),
  });
  const assign = useApiMutation({
    mutationFn: ({ id, ownerId }: { id: string; ownerId: string }) => api.issues.assign(id, ownerId),
    invalidate: keys,
    onSuccess: () => toast('已改派處理人'),
  });
  const respond = useApiMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.issues.respond(id, text),
    invalidate: keys,
    onSuccess: () => toast('已回應，並通知回報者'),
  });
  const resolve = useApiMutation({ mutationFn: api.issues.resolve, invalidate: keys, onSuccess: () => toast('問題已解決') });
  const replan = useApiMutation({ mutationFn: api.issues.replan, invalidate: keys, onSuccess: () => toast('已通知 Leader 重新規劃') });
  return { report, assign, respond, resolve, replan };
}

export function useProposalActions() {
  const keys = [['proposals'], ['notifications'], ['backlog']];
  const create = useApiMutation({
    mutationFn: (input: CreateProposalInput) => api.proposals.create(input),
    invalidate: keys,
    onSuccess: () => toast('已送出提案，並通知 Leader'),
  });
  const comment = useApiMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => api.proposals.comment(id, text),
    invalidate: keys,
  });
  const decide = useApiMutation({
    mutationFn: ({ id, input }: { id: string; input: DecideProposalInput }) => api.proposals.decide(id, input),
    invalidate: keys,
    onSuccess: () => toast('已記錄決策'),
  });
  return { create, comment, decide };
}

/* ---------- G7：結束 Sprint 與回顧 ---------- */

export function useEndSprint() {
  return useApiMutation({
    mutationFn: api.sprints.end,
    invalidate: [['sprints'], ['tasks'], ['retros'], ['project']],
  });
}

export function useRetroActions() {
  const keys = [['retros']];
  const submitEntry = useApiMutation({
    mutationFn: ({ sprintId, input }: { sprintId: number; input: SubmitRetroEntryInput }) => api.retros.submitEntry(sprintId, input),
    invalidate: keys,
    onSuccess: () => toast('已送出你的回顧'),
  });
  const addAction = useApiMutation({
    mutationFn: ({ sprintId, input }: { sprintId: number; input: AddRetroActionInput }) => api.retros.addAction(sprintId, input),
    invalidate: keys,
  });
  const toggleAction = useApiMutation({
    mutationFn: ({ sprintId, actionId }: { sprintId: number; actionId: string }) => api.retros.toggleAction(sprintId, actionId),
    invalidate: keys,
  });
  const close = useApiMutation({
    mutationFn: api.retros.close,
    invalidate: keys,
    onSuccess: () => toast('回顧已結束，改善行動會顯示在下次規劃前的統整'),
  });
  return { submitEntry, addAction, toggleAction, close };
}
