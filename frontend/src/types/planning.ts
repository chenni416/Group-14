import type { Domain } from './member';

/** Sprint 規劃流程：0 設定 → A Story 審核 → B Task 拆解與派工 → C 派工總覽與發送 */
export type PlanningStage = 'setup' | 'stories' | 'tasks' | 'review';

export type BranchPrefix = 'feat' | 'fix' | 'test' | 'refactor' | 'chore';
export const BRANCH_PREFIXES: BranchPrefix[] = ['feat', 'fix', 'test', 'refactor', 'chore'];

/** 審查人員安排：團隊開放搶單／指定 Leader／指定特定成員 */
export type ReviewerMode = 'pool' | 'leader' | 'member';

export interface ReviewerAssignment {
  mode: ReviewerMode;
  memberId: string | null;
}

export interface MinutesQuote {
  /** 會議紀錄行號（1 起算） */
  line: number;
  text: string;
}

export interface StoryDraft {
  id: string;
  /** 識別碼，例如 S3-1 */
  code: string;
  title: string;
  /** 使用者故事描述：身為…我想要…以便… */
  userStory: string;
  storyPoints: number;
  /** 任務範疇輪廓預覽 */
  scope: string[];
  /** AI 拆解依據 */
  rationale: string;
  /** 對應的會議紀錄原文，用於溯源 */
  sources: MinutesQuote[];
}

export interface TaskDraft {
  id: string;
  storyId: string;
  /** 任務編號，例如 TL-301 */
  code: string;
  title: string;
  domain: Domain;
  branchPrefix: BranchPrefix;
  /** 分支摘要敘述（kebab-case） */
  branchSlug: string;
  storyPoints: number;
  acceptanceCriteria: string[];
  assigneeId: string | null;
  suggestedAssigneeId: string | null;
  reviewer: ReviewerAssignment;
  /** AI 技術分析 */
  analysis: string;
  /** AI 指派建議理由 */
  assignReason: string;
}

export interface PlanningDraft {
  sprintId: number;
  stories: StoryDraft[];
  tasks: TaskDraft[];
}

export interface GenerateDraftInput {
  goal: string;
  minutes: string;
}

export interface PlanningChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface GenerateTasksInput {
  sprintId: number;
  /** 要拆解 Task 的 Story（已有 Task 的 Story 不需重送） */
  stories: StoryDraft[];
  /** 草稿中既有的 Task 數，新任務編號接續其後 */
  existingTaskCount: number;
}
