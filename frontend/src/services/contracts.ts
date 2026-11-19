import type {
  AcceptanceCheck,
  AcceptanceItem,
  AcceptanceRecord,
  AddRetroActionInput,
  BacklogDecision,
  BacklogItem,
  BurndownPoint,
  ChatMessage,
  CreateProposalInput,
  CreateSprintInput,
  CreateTaskInput,
  DecideProposalInput,
  Dependency,
  ExecutionPlan,
  GenerateDraftInput,
  GenerateTasksInput,
  InviteMemberInput,
  Issue,
  KnowledgeDoc,
  Member,
  NegotiateInput,
  NewSprintDefaults,
  Notification,
  Organization,
  PlanningDraft,
  Project,
  PromptState,
  Proposal,
  ReportIssueInput,
  Retro,
  ReviewPolicy,
  SaveExecutionPlanInput,
  ReviseTaskInput,
  SearchHit,
  SetCarryInput,
  Sprint,
  SubmitDeliveryInput,
  SubmitRetroEntryInput,
  Task,
  TaskDraft,
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
  /** G7：結束進行中的 Sprint 並開啟回顧，回傳未完成任務數 */
  end(id: number): Promise<{ unfinished: number }>;
  /** 啟動 Sprint：上個 Sprint 的未完成任務依選擇帶入或延後 */
  start(id: number): Promise<{ carriedOver: number; deferred: number }>;
  burndown(id: number): Promise<BurndownPoint[]>;
  /** 延續事項（下次建立 Sprint 時自動帶入會議紀錄） */
  backlog(): Promise<BacklogItem[]>;
  /** 上輪統整：延續事項納入本輪、繼續保留或移除（移除在啟動 Sprint 時生效） */
  decideBacklog(id: string, decision: BacklogDecision | null): Promise<BacklogItem>;
  removeBacklog(id: string): Promise<void>;
  /** AI 相依性分析：本次任務與上一個 Sprint 的相依性 */
  dependencies(id: number): Promise<Dependency[]>;
}

/** Reviewer 對每條驗收條件的判斷（沿用 AI 時為 null） */
export type ReviewItemsInput = Pick<AcceptanceItem, 'reviewer' | 'note'>[];

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
  /** 上輪未完成的任務：帶入本輪（可改派，啟動 Sprint 時套用）或延後；送出派工後不能再改 */
  setCarry(id: string, input: SetCarryInput): Promise<Task>;
  /** 成員協商退回帶入／延後決定後，Leader 修改並重新發送確認 */
  resendCarry(id: string, input: SetCarryInput): Promise<Task>;
  /** 協商退回：修改後發送給目前負責人（可以是原成員） */
  resend(id: string): Promise<{ task: Task; changes: string[] }>;
  /** 協商退回：AI 重新建議負責人（排除提出協商的成員） */
  suggestAssignee(id: string): Promise<{ task: Task; fits: boolean }>;
  /** 協商退回：復原到退回當下的內容 */
  resetReturn(id: string): Promise<Task>;
  /** 協商退回後編輯任務並重新發送指派邀請（回到待確認） */
  revise(id: string, input: ReviseTaskInput): Promise<Task>;
  accept(id: string): Promise<Task>;
  negotiate(id: string, input: NegotiateInput): Promise<Task>;
  claimReview(id: string): Promise<Task>;
  startDevelopment(id: string): Promise<Task>;
  /** G5：送審時一併提交交付內容（PR 連結只是文字，不串 GitHub） */
  submitForReview(id: string, delivery?: SubmitDeliveryInput): Promise<Task>;
  /** G5：核准；帶入 items 時一併記錄逐條驗收判斷與證據 */
  approveReview(id: string, items?: ReviewItemsInput): Promise<ReviewResult>;
  requestChanges(id: string, note: string, items?: ReviewItemsInput): Promise<Task>;
  /** G2：成員對延後或調整的回覆 */
  confirmPlan(id: string, status: 'agree' | 'object', note: string): Promise<Task>;
  updatePolicy(id: string, policy: ReviewPolicy): Promise<Task>;
}

export interface PlanningService {
  getSampleMinutes(): Promise<string>;
  /** AI 分析會議紀錄，產生 Story 切分草稿（尚未拆解 Task，供 Leader 審核） */
  generateDraft(input: GenerateDraftInput): Promise<PlanningDraft>;
  /** 依確認後的 Story 拆解 Task（全部未指派） */
  generateTasks(input: GenerateTasksInput): Promise<TaskDraft[]>;
  /** 核准規劃：建立任務並發送指派邀請，回傳任務數 */
  submitPlan(draft: PlanningDraft): Promise<{ count: number }>;
  /** 與 AI 對話微調 Story 切分，回傳回覆文字 */
  askStoryAssistant(question: string, storyTitle: string | null): Promise<string>;
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

/** G3：成員的執行計畫 */
export interface ExecutionService {
  list(): Promise<ExecutionPlan[]>;
  get(taskId: string): Promise<ExecutionPlan | null>;
  /** AI 依任務規格、依賴與專案文件產生計畫建議（尚未確認） */
  suggest(taskId: string): Promise<ExecutionPlan>;
  save(taskId: string, input: SaveExecutionPlanInput): Promise<ExecutionPlan>;
  confirm(taskId: string): Promise<ExecutionPlan>;
  toggleItem(taskId: string, itemId: string): Promise<ExecutionPlan>;
  toggleCheckpoint(taskId: string, checkpointId: string): Promise<ExecutionPlan>;
}

/** G4：問題回報（Report → Assign Owner → Respond → Resolve / Replan） */
export interface IssueService {
  list(): Promise<Issue[]>;
  report(input: ReportIssueInput): Promise<Issue>;
  assign(id: string, ownerId: string): Promise<Issue>;
  respond(id: string, text: string): Promise<Issue>;
  resolve(id: string): Promise<Issue>;
  replan(id: string): Promise<Issue>;
}

/** G4：提案（任何人可提案與留言，Leader 決策） */
export interface ProposalService {
  list(): Promise<Proposal[]>;
  create(input: CreateProposalInput): Promise<Proposal>;
  comment(id: string, text: string): Promise<Proposal>;
  decide(id: string, input: DecideProposalInput): Promise<Proposal>;
}

/** G5：AI 驗收檢查與驗收紀錄 */
export interface AcceptanceService {
  check(taskId: string): Promise<AcceptanceCheck>;
  records(taskId: string): Promise<AcceptanceRecord[]>;
}

/** G7：Sprint 回顧與改善行動 */
export interface RetroService {
  get(sprintId: number): Promise<Retro>;
  list(): Promise<Retro[]>;
  submitEntry(sprintId: number, input: SubmitRetroEntryInput): Promise<Retro>;
  addAction(sprintId: number, input: AddRetroActionInput): Promise<Retro>;
  toggleAction(sprintId: number, actionId: string): Promise<Retro>;
  close(sprintId: number): Promise<Retro>;
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
  execution: ExecutionService;
  issues: IssueService;
  proposals: ProposalService;
  acceptance: AcceptanceService;
  retros: RetroService;
}
