import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import { BOARD_STATES, type Member, type Task } from '@/types';

export const useCurrentUser = () => useQuery({ queryKey: queryKeys.me, queryFn: api.auth.me });
export const useMembers = () => useQuery({ queryKey: queryKeys.members, queryFn: api.members.list });
export const useOrganization = () => useQuery({ queryKey: queryKeys.org, queryFn: api.workspace.getOrganization });
export const useProject = () => useQuery({ queryKey: queryKeys.project, queryFn: api.workspace.getProject });
export const useSprints = () => useQuery({ queryKey: queryKeys.sprints, queryFn: api.sprints.list });
export const useTasks = () => useQuery({ queryKey: queryKeys.tasks, queryFn: api.tasks.list });
export const useNotifications = () =>
  useQuery({ queryKey: queryKeys.notifications, queryFn: api.notifications.list });

export const useDocs = () =>
  useQuery({
    queryKey: queryKeys.docs,
    queryFn: api.docs.list,
    // 有文件仍在索引時輪詢進度
    refetchInterval: (q) => (q.state.data?.some((d) => d.progress < 100) ? 500 : false),
  });

export function useMemberMap() {
  const { data } = useMembers();
  return useMemo(() => new Map<string, Member>((data ?? []).map((m) => [m.id, m])), [data]);
}

/** 目前進行中與規劃中的 Sprint，以及各自的任務 */
export function useSprintContext() {
  const project = useProject();
  const sprints = useSprints();
  const tasks = useTasks();

  return useMemo(() => {
    const p = project.data;
    const all = tasks.data ?? [];
    const active = sprints.data?.find((s) => s.id === p?.activeSprintId);
    const planning = sprints.data?.find((s) => s.id === p?.planningSprintId);
    const boardTasks = all.filter(
      (t) => t.sprintId === active?.id && (BOARD_STATES as readonly string[]).includes(t.state),
    );
    const planningTasks: Task[] = planning ? all.filter((t) => t.sprintId === planning.id) : [];
    const planningReady =
      planning?.status === 'planning' &&
      planningTasks.length > 0 &&
      planningTasks.every((t) => t.state === 'ASSIGNED');
    return {
      isLoading: project.isLoading || sprints.isLoading || tasks.isLoading,
      project: p,
      allTasks: all,
      active,
      planning,
      boardTasks,
      planningTasks,
      planningReady,
    };
  }, [project.data, project.isLoading, sprints.data, sprints.isLoading, tasks.data, tasks.isLoading]);
}
