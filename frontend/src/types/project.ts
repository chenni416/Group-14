import type { ReviewPolicy } from './review-policy';

export interface Team {
  name: string;
  memberCount: number;
  current: boolean;
}

export interface Organization {
  name: string;
  slug: string;
  plan: string;
  teams: Team[];
}

export type GitProvider = 'GitHub' | 'GitLab';

export interface Project {
  name: string;
  prefix: string;
  provider: GitProvider;
  repo: string;
  branchPattern: string;
  sprintLength: string;
  defaultPolicy: ReviewPolicy;
  activeSprintId: number;
  /** 規劃中的 Sprint；null 表示目前沒有 */
  planningSprintId: number | null;
}

export type UpdateProjectInput = Partial<Omit<Project, 'activeSprintId' | 'planningSprintId'>>;

export interface KnowledgeDoc {
  id: string;
  name: string;
  kind: string;
  size: string;
  /** 索引進度 0–100 */
  progress: number;
  chunks: number;
  isLink: boolean;
}

export interface UploadDocInput {
  name: string;
  size: number;
}

export interface SearchHit {
  source: string;
  excerpt: string;
  score: number;
}
