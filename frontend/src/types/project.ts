import type { MemberRole } from './member';
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

export type GithubLinkStatus = 'none' | 'pending' | 'linked' | 'revoked';

export interface Project {
  name: string;
  /** G1：專案整體目標 */
  goal: string;
  prefix: string;
  provider: GitProvider;
  repo: string;
  branchPattern: string;
  sprintLength: string;
  defaultPolicy: ReviewPolicy;
  /** 是否整合 Git：true 時才進行 repo 連結與同步（由 GitHub 整合設定） */
  gitIntegration: boolean;
  /** repo 連結狀態：none 尚未連結、pending 等待 repo 擁有者核准、linked 已連結、revoked 權限被收回 */
  githubLinkStatus?: GithubLinkStatus;
  githubRepoUrl?: string;
  activeSprintId: number;
  /** 規劃中的 Sprint；null 表示目前沒有 */
  planningSprintId: number | null;
}

/** 「我的專案」清單的一項（側邊欄的專案切換用） */
export interface ProjectSummary {
  id: string;
  name: string;
  prefix: string;
  /** 我在這個專案的角色 */
  role: MemberRole;
}

export interface CreateProjectInput {
  name: string;
  /** 專案代碼，例如 TL */
  prefix: string;
  goal?: string;
  sprintLength?: string;
  gitIntegration?: boolean;
  /** GitHub repo（https://github.com/owner/repo 或 owner/repo）；整合 Git 時必填 */
  repo?: string | null;
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
