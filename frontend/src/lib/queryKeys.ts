export const queryKeys = {
  me: ['me'] as const,
  members: ['members'] as const,
  org: ['org'] as const,
  project: ['project'] as const,
  docs: ['docs'] as const,
  sprints: ['sprints'] as const,
  burndown: (sprintId: number) => ['sprints', sprintId, 'burndown'] as const,
  tasks: ['tasks'] as const,
  notifications: ['notifications'] as const,
  chat: (taskId: string) => ['tasks', taskId, 'chat'] as const,
  prompt: (taskId: string) => ['tasks', taskId, 'prompt'] as const,
};
