import type { Services } from '../contracts';
import { notifications, planning, sprints, studio, tasks } from './tasks';
import { acceptance, execution, issues, proposals, retros } from './collab';
import { auth, docs, members, workspace } from './workspace';

export const mockServices: Services = {
  auth,
  members,
  workspace,
  docs,
  sprints,
  tasks,
  planning,
  notifications,
  studio,
  execution,
  issues,
  proposals,
  acceptance,
  retros,
};
