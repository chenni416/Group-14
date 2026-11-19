import type { StoryDraft, TaskDraft } from '@/types';

/**
 * 預設 Mock 場景：Sprint 3「對話式 Prompt Studio 與 PR Review 機制」。
 * 行號對應 SAMPLE_MINUTES，用於右側「會議紀錄溯源」。
 * 未來由後端 AI 拆解 API 產生同樣結構的資料。
 */
export const SCENARIO_STORIES: Omit<StoryDraft, 'code' | 'no'>[] = [
  {
    id: 'st-1',
    clarify: [
      {
        id: 'cq-1-1',
        kind: 'question',
        text: '會議只提到「對話可以問專案問題」，對話紀錄要保留多久？成員離開專案後是否還能查看？',
        options: ['整個 Sprint 期間保留', '永久保留', 'Sprint 結束後封存'],
        effect: '對話紀錄保存規則：{answer}',
      },
      {
        id: 'cq-1-2',
        kind: 'question',
        text: '手機寬度下 Split View 要怎麼呈現？',
        options: ['改為上下排列', '只保留對話區', '以分頁切換規格與對話'],
        effect: '手機版版面：{answer}',
      },
      {
        id: 'cq-1-3',
        kind: 'suggestion',
        text: 'Prompt 版本紀錄與對話 API 共用資料模型，建議先完成資料表與 API，再開始前端畫面。',
        effect: 'Task 拆解時，將版本紀錄 API 標為前端畫面的前置任務',
      },
    ],
    dependsOn: [],
    title: '任務內 AI 對話釐清規格',
    userStory: '身為開發成員，我想要在任務詳情中直接詢問專案脈絡，以便不用重打背景就能釐清規格並取得可用的 Prompt。',
    storyPoints: 11,
    scope: ['Split View 任務詳情介面', '掛載知識庫的脈絡對話 API', 'Prompt 版本紀錄與還原'],
    rationale:
      '會議中「左右分割對話」與「Prompt 隨對話更新」兩項需求共用同一個使用情境（成員在任務內釐清規格），合併為一個 Story 可以一次交付完整體驗；前端畫面、AI 服務與版本資料表分屬不同領域，進入 Task 拆解後可以平行開發。',
    sources: [
      { line: 5, text: '任務詳情要改成左右分割，右邊是可以問專案問題的 AI 對話' },
      { line: 6, text: 'Prompt 要能隨對話更新，保留版本可以還原' },
    ],
  },
  {
    id: 'st-2',
    clarify: [
      {
        id: 'cq-2-1',
        kind: 'question',
        text: '「指定成員、全員同意」模式中有人退回時，是否需要所有人重新審查？',
        options: ['全部重新審查', '只需退回者重新審查'],
        effect: '全員同意模式退回後：{answer}',
      },
      {
        id: 'cq-2-2',
        kind: 'suggestion',
        text: 'Webhook 簽章驗證涉及部署環境的 secret，建議拆成獨立 Task，並指定熟悉部署的成員審查。',
        effect: 'Task 拆解時，將「GitHub PR Webhook 自動送審」拆成獨立 Task，審查人建議熟悉 CI 的成員',
      },
      {
        id: 'cq-2-3',
        kind: 'question',
        text: 'In Review 卡片要顯示審查等待時間嗎？',
        options: ['要，超過 24 小時標示提醒', '要，只顯示時間', '不需要'],
        effect: '審查等待時間：{answer}',
      },
    ],
    dependsOn: [],
    title: '彈性 PR Review 路由',
    userStory: '身為 Leader，我想要依任務的關鍵程度設定審核方式，以便重要變更由合適的人把關、一般任務能快速被認領審查。',
    storyPoints: 10,
    scope: ['三種 Review 模式設定元件', '審核狀態機與通知派發', 'GitHub PR Webhook 自動送審', 'In Review 卡片狀態呈現'],
    rationale:
      '三種審核模式、PR webhook 自動進入 In Review、看板顯示審查進度，都是「PR 發布後如何被審查」這條流程的一部分。後端路由服務是其他三項的依賴，建議優先排程；Webhook 涉及外部簽章驗證，拆解時建議獨立出來，方便指定熟悉部署的成員審查。',
    sources: [
      { line: 7, text: 'Review 要支援三種模式：Leader 專審、團隊搶單、指定成員' },
      { line: 8, text: '看板 In Review 卡片要顯示誰在審、審了多久' },
      { line: 9, text: '需要 GitHub PR webhook，PR 開啟時自動進 In Review' },
    ],
  },
  {
    id: 'st-3',
    clarify: [
      {
        id: 'cq-3-1',
        kind: 'question',
        text: '成員協商退回任務時，是否必須建議替代人選？',
        options: ['必填', '選填', '不提供此欄位'],
        effect: '協商退回的替代人選：{answer}',
      },
      {
        id: 'cq-3-2',
        kind: 'suggestion',
        text: 'E2E 測試同時涵蓋認領與 Review 流程，建議排在 S3-2 的 Review 路由完成之後；若要提早開始，可先以模擬事件撰寫。',
        effect: 'Task 拆解時，將 E2E 測試標為依賴 Review 路由服務',
      },
    ],
    dependsOn: [{ id: 'st-2', reason: '收件匣的 Review 通知與 E2E 測試需要 Review 路由與通知服務先完成' }],
    title: '任務認領收件匣與流程測試',
    userStory: '身為開發成員，我想要在開工前接受或協商被指派的任務，以便工作量在 Sprint 啟動前取得共識。',
    storyPoints: 6,
    scope: ['Action Required Inbox 介面', '認領與 Review 的 E2E 測試'],
    rationale:
      '通知中心的接受／協商是 Sprint 啟動前的最後一道確認；E2E 測試同時涵蓋認領與 Review 兩條流程，放在同一個 Story 可以在驗收時一起確認多角色情境。',
    sources: [
      { line: 10, text: '通知中心：成員可以接受或協商轉移' },
      { line: 11, text: 'E2E 測試涵蓋認領與 Review 流程' },
    ],
  },
];

export const SCENARIO_TASKS: Omit<TaskDraft, 'code' | 'no'>[] = [
  // Story 1
  {
    id: 'tk-1', storyId: 'st-1', title: '任務詳情 Split View 介面（規格／對話）', domain: 'FE',
    dependsOn: [{ id: 'tk-2', reason: '對話區需要串接脈絡對話 API 的串流回應' }],
    branchPrefix: 'feat', branchSlug: 'task-split-view', storyPoints: 3,
    acceptanceCriteria: ['左側為任務規格與 Prompt 畫布，右側為對話區', '對話訊息支援串流顯示與 Markdown', '375px 手機寬度改為上下排列'],
    assigneeId: null, suggestedAssigneeId: 'm1', reviewer: { mode: 'member', memberId: 'm5' },
    analysis: '新版面需要同時維護規格區與對話區的捲動狀態，並處理串流訊息逐字渲染。可沿用現有 Card 與 Drawer 元件，主要工作量在 RWD 與訊息列表虛擬化。',
    assignReason: '陳怡君為 Frontend Lead，吻合 React、TypeScript、Tailwind 技能；若同時承接 Review Policy 元件，負擔為 5/8 SP，仍有餘裕。建議由設計師李雅婷審查畫面一致性。',
  },
  {
    id: 'tk-2', storyId: 'st-1', title: '專案脈絡對話 API（掛載知識庫 RAG）', domain: 'AI',
    dependsOn: [{ id: 'S-213', reason: 'RAG 需要上輪「知識庫文件索引 Pipeline」產生的向量資料' }],
    branchPrefix: 'feat', branchSlug: 'context-chat-api', storyPoints: 5,
    acceptanceCriteria: ['每次對話自動帶入任務規格、Sprint Goal 與相關文件片段', '回覆附上引用來源文件', '單次回應延遲 p90 < 3 秒'],
    assigneeId: null, suggestedAssigneeId: 'm3', reviewer: { mode: 'leader', memberId: null },
    analysis: '需組裝任務、Sprint 與向量檢索結果作為上下文，並控制 token 長度。屬新服務，涉及 pgvector 查詢與 LangChain pipeline，影響全系統回覆品質。',
    assignReason: '王思妤為 AI Engineer，吻合 LLM、RAG、Python 技能；此任務影響核心 AI 行為，建議 Leader 專審。',
  },
  {
    id: 'tk-3', storyId: 'st-1', title: 'Prompt 版本紀錄與還原 API', domain: 'BE',
    dependsOn: [],
    branchPrefix: 'feat', branchSlug: 'prompt-versions', storyPoints: 3,
    acceptanceCriteria: ['每次對話更新產生新版本並記錄差異', '可還原至任一歷史版本', '資料表變更附 Alembic migration'],
    assigneeId: null, suggestedAssigneeId: 'm2', reviewer: { mode: 'pool', memberId: null },
    analysis: '需新增 prompt_versions 資料表並提供列表、還原兩個端點。邏輯單純，主要風險在 migration 與既有資料相容。',
    assignReason: '林柏翰為 Backend Engineer，吻合 FastAPI、PostgreSQL 技能；指派後負擔為 8/10 SP。一般 CRUD 建議開放團隊搶單審查。',
  },
  // Story 2
  {
    id: 'tk-4', storyId: 'st-2', title: 'Review Policy 設定元件（三種模式）', domain: 'FE',
    dependsOn: [],
    branchPrefix: 'feat', branchSlug: 'review-policy-ui', storyPoints: 2,
    acceptanceCriteria: ['支援 Leader 專審、團隊搶單、指定成員', '指定成員可設定需 1 人或全員同意', '任務層級設定可覆蓋專案預設'],
    assigneeId: null, suggestedAssigneeId: 'm1', reviewer: { mode: 'pool', memberId: null },
    analysis: '表單元件搭配條件欄位，沿用 SegmentedControl 即可完成，無新 API 依賴，可與後端路由服務平行開發。',
    assignReason: '陳怡君熟悉現有元件庫，可快速完成；屬前端元件修飾，建議團隊搶單審查。',
  },
  {
    id: 'tk-5', storyId: 'st-2', title: 'Review 路由與通知服務', domain: 'BE',
    dependsOn: [],
    branchPrefix: 'feat', branchSlug: 'review-routing', storyPoints: 5,
    acceptanceCriteria: ['依策略發送個人通知或推送公共池', 'Claim 具併發保護，同時只有一人認領成功', '全員同意模式需全部核准才轉 Done'],
    assigneeId: null, suggestedAssigneeId: 'm2', reviewer: { mode: 'leader', memberId: null },
    analysis: '需設計審核狀態機與通知派發，涉及資料表更動與併發控制，是本 Story 其他 Task 的依賴，建議排在 Sprint 前半完成。',
    assignReason: '林柏翰負責既有通知與資料模型；涉及核心狀態機，建議 Leader 專審。',
  },
  {
    id: 'tk-6', storyId: 'st-2', title: 'GitHub PR Webhook 接收與簽章驗證', domain: 'BE',
    dependsOn: [{ id: 'tk-5', reason: 'Webhook 收到 PR 事件後要交給 Review 路由服務套用審核策略' }],
    branchPrefix: 'feat', branchSlug: 'pr-webhook', storyPoints: 3,
    acceptanceCriteria: ['驗證 X-Hub-Signature-256，失敗回傳 401', 'PR opened 時任務轉為 In Review 並套用審核策略', '重複事件具冪等性'],
    assigneeId: null, suggestedAssigneeId: 'm4', reviewer: { mode: 'member', memberId: 'm2' },
    analysis: '外部事件需驗證 HMAC 簽章並處理重送與亂序，需在部署環境設定 secret。與路由服務有介面依賴，可先以 mock 事件開發。',
    assignReason: '林柏翰若再承接將超出 Capacity（11/10 SP），建議改由熟悉 Docker 與 CI 的張家豪處理，並指定林柏翰審查與路由服務的整合。',
  },
  // Story 3
  {
    id: 'tk-7', storyId: 'st-3', title: 'Action Required Inbox（接受／協商）', domain: 'FE',
    dependsOn: [
      { id: 'S-231', reason: '依上輪的「通知中心 UI 設計稿」實作' },
      { id: 'tk-5', reason: '接受與協商動作需要通知服務的 API' },
    ],
    branchPrefix: 'feat', branchSlug: 'inbox-accept-negotiate', storyPoints: 3,
    acceptanceCriteria: ['顯示指派人、點數與任務摘要', '接受後狀態改為 Assigned', '協商需填原因並可建議人選，退回 Leader'],
    assigneeId: null, suggestedAssigneeId: 'm5', reviewer: { mode: 'member', memberId: 'm1' },
    analysis: '新頁面搭配對話框與狀態回饋，設計稿已在 Sprint 2 完成，主要為實作與互動細節。',
    assignReason: '李雅婷完成了通知中心設計稿且具備 React 技能，由她實作可確保與設計一致；建議由 Frontend Lead 陳怡君審查程式碼。',
  },
  {
    id: 'tk-8', storyId: 'st-3', title: 'E2E 測試：認領與 Review 流程', domain: 'QA',
    dependsOn: [
      { id: 'tk-7', reason: 'E2E 需要 Inbox 頁面完成' },
      { id: 'tk-5', reason: 'E2E 需要 Review 路由流程完成' },
    ],
    branchPrefix: 'test', branchSlug: 'e2e-claim-review', storyPoints: 3,
    acceptanceCriteria: ['涵蓋接受、協商退回與三種 Review 模式', '測試資料以 seed script 建立', '在 CI 無頭模式全數通過'],
    assigneeId: null, suggestedAssigneeId: 'm4', reviewer: { mode: 'pool', memberId: null },
    analysis: '需建立多角色測試資料並模擬通知與審核流程，依賴 Inbox 與路由服務完成，建議排在 Sprint 後半。',
    assignReason: '張家豪負責 Playwright 與 CI 環境，吻合測試技能；測試程式建議團隊搶單審查。',
  },
];

/**
 * 示範用：規劃送出後立即模擬部分成員的回覆，讓「待確認／協商退回／已接受」泳道都有資料。
 * 鍵值為上方 SCENARIO_TASKS 的 id。串接真實後端後應移除。
 */
export const SIMULATED_RESPONSES: {
  returned: Array<{ taskId: string; reason: string }>;
  accepted: string[];
} = {
  returned: [
    {
      taskId: 'tk-3',
      reason: '這張 API 串接需要等後端 Schema 確認，建議點數從 3 SP 調整為 5 SP 或延後處理',
    },
  ],
  accepted: ['tk-1', 'tk-4', 'tk-8'],
};
