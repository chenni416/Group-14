import type { Domain } from './member';

/** Sprint 規劃流程：1 上輪統整 → 2 設定 → 3 Story 審核 → 4 Task 拆解與派工 → 5 派工總覽與發送 */
export type PlanningStage = 'carry' | 'setup' | 'stories' | 'tasks' | 'review';

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

/** 規劃草稿中的相依：依賴的 Story／Task（Task 也可以依賴上輪帶入的正式任務） */
export interface DraftDependency {
  /** 依賴對象：StoryDraft.id、TaskDraft.id，或上輪帶入任務的 Task.id */
  id: string;
  reason: string;
}

export interface StoryDraft {
  id: string;
  /** Story 序號（建立時決定，之後不重排），對應編號 S3-1 的 1 */
  no: number;
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
  /** 依賴的其他 Story */
  dependsOn: DraftDependency[];
  /** 延後到之後的 Sprint：留在原位並標註，不計容量、不派工，送出前可以取消延後 */
  deferred?: boolean;
}

export interface TaskDraft {
  id: string;
  storyId: string;
  /** Story 內的 Task 序號（建立時決定，之後不重排） */
  no: number;
  /** 任務編號 S-{Sprint}{Story 序號}{Task 序號}，例如 S-321，數字與分支名稱 S321 相同 */
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
  /** 依賴的 Task（本輪 Task 或上輪帶入任務） */
  dependsOn: DraftDependency[];
  /** 延後到之後的 Sprint：留在原位並標註，不計容量、不派工，送出前可以取消延後 */
  deferred?: boolean;
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
