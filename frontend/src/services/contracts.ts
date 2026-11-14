import type {
  BacklogItem,
  BurndownPoint,
  ChatMessage,
  CreateSprintInput,
  CreateTaskInput,
  Dependency,
  InviteMemberInput,
  KnowledgeDoc,
  Member,
  NegotiateInput,
  NewSprintDefaults,
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
  UpdateSprintInput,
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
  /** 建立 Sprint 對話框的預設值（日期、Capacity、已帶入延續事項的會議紀錄） */
  defaults(): Promise<NewSprintDefaults>;
  create(input: CreateSprintInput): Promise<Sprint>;
  update(id: number, patch: UpdateSprintInput): Promise<Sprint>;
  addDocs(id: number, files: UploadDocInput[]): Promise<Sprint>;
  /** ① 輸入：AI 分析會議紀錄，產生待釐清問題，回傳未回答數 */
  analyze(id: number, minutes: string): Promise<{ unanswered: number }>;
  answer(id: number, questionId: string, answer: string): Promise<Sprint>;
  /** 啟動 Sprint：上個 Sprint 的未完成任務依選擇帶入或延後 */
  start(id: number): Promise<{ carriedOver: number; deferred: number }>;
  burndown(id: number): Promise<BurndownPoint[]>;
  /** 延續事項（下次建立 Sprint 時自動帶入會議紀錄） */
  backlog(): Promise<BacklogItem[]>;
  removeBacklog(id: string): Promise<void>;
  /** AI 相依性分析：本次任務與上一個 Sprint 的相依性 */
  dependencies(id: number): Promise<Dependency[]>;
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
  /** 核准所有草稿並發送指派邀請（會先做核准前檢查），回傳數量 */
  approveDrafts(): Promise<{ count: number }>;
  /** 延後到下個 Sprint（記錄到延續事項） */
  defer(id: string): Promise<Task>;
  restore(id: string): Promise<Task>;
  /** 上個 Sprint 未完成的任務：帶入本次或延後 */
  setCarry(id: string, carry: boolean): Promise<Task>;
  /** 協商退回：修改後發送給目前負責人（可以是原成員） */
  resend(id: string): Promise<{ task: Task; changes: string[] }>;
  /** 協商退回：AI 重新建議負責人（排除提出協商的成員） */
  suggestAssignee(id: string): Promise<{ task: Task; fits: boolean }>;
  /** 協商退回：復原到退回當下的內容 */
  resetReturn(id: string): Promise<Task>;
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
  getSampleMinutes(): Promise<string>;
  /** ② AI 拆解規劃中 Sprint 的會議紀錄（待釐清問題需全部回答），回傳新增數 */
  decompose(sprintId: number): Promise<{ created: number }>;
  /** 依 AI 容量建議延後任務 */
  deferSuggested(sprintId: number): Promise<{ deferred: number }>;
  /** AI 重新平衡指派：只調整 Leader 沒動過的 AI 草稿 */
  rebalance(sprintId: number): Promise<{ updated: number }>;
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
