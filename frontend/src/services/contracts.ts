import type {
  BurndownPoint,
  ChatMessage,
  InviteMemberInput,
  KnowledgeDoc,
  Member,
  NegotiateInput,
  Notification,
  GenerateDraftInput,
  GenerateTasksInput,
  Organization,
  PlanningDraft,
  Project,
  PromptState,
  ReviewPolicy,
  ReviseTaskInput,
  SearchHit,
  Sprint,
  Task,
  TaskDraft,
  UpdateMemberInput,
  UpdateProjectInput,
  UploadDocInput,
} from '@/types';

/**
 * 前端與後端之間的契約。UI 只依賴這些介面，
 * 由 services/index.ts 決定使用 mock 或 http 實作。
 */
export interface AuthService {
  me(): Promise<Member>;
  /** 開發用：切換示範身分（真實後端改為重新登入） */
  switchUser(memberId: string): Promise<Member>;
}

export interface MemberService {
  list(): Promise<Member[]>;
  invite(input: InviteMemberInput): Promise<Member>;
  update(id: string, patch: UpdateMemberInput): Promise<Member>;
}

export interface WorkspaceService {
  getOrganization(): Promise<Organization>;
  getProject(): Promise<Project>;
  updateProject(patch: UpdateProjectInput): Promise<Project>;
}

export interface DocService {
  list(): Promise<KnowledgeDoc[]>;
  upload(files: UploadDocInput[]): Promise<KnowledgeDoc[]>;
  addLink(url: string): Promise<KnowledgeDoc>;
  remove(id: string): Promise<void>;
  search(query: string): Promise<SearchHit[]>;
}

export interface SprintService {
  list(): Promise<Sprint[]>;
  updateGoal(id: number, goal: string): Promise<Sprint>;
  /** 啟動 Sprint，回傳從上個 Sprint 帶入的未完成任務數 */
  start(id: number): Promise<{ carriedOver: number }>;
  burndown(id: number): Promise<BurndownPoint[]>;
}

export interface ReviewResult {
  completed: boolean;
  approvals: number;
  required: number;
}

export interface TaskService {
  list(): Promise<Task[]>;
  /** 協商退回後編輯任務並重新發送指派邀請（回到待確認） */
  revise(id: string, input: ReviseTaskInput): Promise<Task>;
  accept(id: string): Promise<Task>;
  negotiate(id: string, input: NegotiateInput): Promise<Task>;
  claimReview(id: string): Promise<Task>;
  startDevelopment(id: string): Promise<Task>;
  submitForReview(id: string): Promise<Task>;
  approveReview(id: string): Promise<ReviewResult>;
  requestChanges(id: string, note: string): Promise<Task>;
  updatePolicy(id: string, policy: ReviewPolicy): Promise<Task>;
}

export interface PlanningService {
  getMinutes(): Promise<string>;
  getSampleMinutes(): Promise<string>;
  /** AI 分析會議紀錄，產生 Story 切分草稿（尚未拆解 Task，供 Leader 審核） */
  generateDraft(input: GenerateDraftInput): Promise<PlanningDraft>;
  /** 核准規劃：建立任務並發送指派邀請，回傳任務數 */
  /** 依確認後的 Story 拆解 Task（全部未指派） */
  generateTasks(input: GenerateTasksInput): Promise<TaskDraft[]>;
  submitPlan(draft: PlanningDraft): Promise<{ count: number }>;
  /** 與 AI 對話微調 Story 切分，回傳回覆文字 */
  askStoryAssistant(question: string, storyTitle: string | null): Promise<string>;
}

export interface NotificationService {
  /** 目前登入者的通知 */
  list(): Promise<Notification[]>;
}

export interface StudioService {
  getPrompt(taskId: string): Promise<PromptState>;
  setPromptVersion(taskId: string, version: number): Promise<PromptState>;
  getChat(taskId: string): Promise<ChatMessage[]>;
  ask(taskId: string, question: string): Promise<ChatMessage>;
}

export interface Services {
  auth: AuthService;
  members: MemberService;
  workspace: WorkspaceService;
  docs: DocService;
  sprints: SprintService;
  tasks: TaskService;
  planning: PlanningService;
  notifications: NotificationService;
  studio: StudioService;
}
