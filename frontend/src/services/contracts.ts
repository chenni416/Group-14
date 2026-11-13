import type {
  BurndownPoint,
  ChatMessage,
  CreateTaskInput,
  InviteMemberInput,
  KnowledgeDoc,
  Member,
  NegotiateInput,
  Notification,
  Organization,
  Project,
  PromptState,
  ReviewPolicy,
  SearchHit,
  Sprint,
  Task,
  UpdateMemberInput,
  UpdateProjectInput,
  UpdateTaskInput,
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
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, patch: UpdateTaskInput): Promise<Task>;
  remove(id: string): Promise<void>;
  /** 核准所有草稿並發送指派邀請，回傳數量 */
  approveDrafts(): Promise<{ count: number }>;
  reassign(id: string, assigneeId: string): Promise<Task>;
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
  /** AI 拆解會議紀錄，回傳新增的 Sub-task 數 */
  decompose(minutes: string): Promise<{ created: number }>;
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
