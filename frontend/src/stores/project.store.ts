import { create } from 'zustand';
import type { BurndownPoint, Domain, ReviewPolicy, TaskState } from '@/types';

/** 示意專案的任務：只保留主頁各卡片需要的欄位 */
export interface DemoTask {
  id: string;
  title: string;
  domain: Domain;
  state: TaskState;
  storyPoints: number;
  assigneeId: string;
  /** 審查中的任務：審查方式與審查人（Review 佇列用） */
  policy?: ReviewPolicy;
  reviewerId?: string | null;
}

/** 示意專案的最新動態 */
export interface DemoActivity {
  id: string;
  memberId: string;
  type: 'done' | 'pr' | 'review' | 'claim';
  taskId: string;
  text: string;
  time: string;
}

const pool: ReviewPolicy = { mode: 'pool', targets: [], rule: 'any' };
const lead: ReviewPolicy = { mode: 'leader', targets: [], rule: 'any' };

/** 依剩餘點數產生 Burndown 示意資料（10 個工作天，已過 days 天） */
function burndown(total: number, remaining: number[], days = 10): BurndownPoint[] {
  return Array.from({ length: days + 1 }, (_, i) => ({
    label: `D${i}`,
    ideal: Math.round(total - (total / days) * i),
    actual: remaining[i] ?? null,
  }));
}

/** Demo 用的專案清單；只有 taskline 會使用真實的 mock 任務資料 */
export interface DemoProject {
  id: string;
  /** 側邊欄 icon 上顯示的縮寫 */
  short: string;
  name: string;
  prefix: string;
  goal: string;
  done: number;
  total: number;
  endDate: string;
  memberCount: number;
  /** 上方統計卡用：進行中、審查中、待我處理的數量 */
  inProgress: number;
  inReview: number;
  action: number;
  /** 示意專案的任務清單（Taskline 用真實資料，所以是空的） */
  tasks: DemoTask[];
  /** 以下為示意專案主頁的假資料（Taskline 用真實資料） */
  sprintName: string;
  activity: DemoActivity[];
  burndown: BurndownPoint[];
  /** 下個 Sprint 的規劃進度：名稱與已派工任務的狀態 */
  planning: { name: string; states: TaskState[] } | null;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'taskline', short: 'TL', name: 'Taskline — 會議到交付平台', prefix: 'TL', goal: '',
    done: 0, total: 0, endDate: '', memberCount: 5, inProgress: 0, inReview: 0, action: 0,
    tasks: [], sprintName: '', activity: [], burndown: [], planning: null,
  },
  {
    id: 'market', short: 'MK', name: '校園二手平台', prefix: 'MK', goal: '完成商品上架與站內聊天功能',
    done: 18, total: 28, endDate: '2026-11-30', memberCount: 4, inProgress: 3, inReview: 1, action: 1,
    tasks: [
      { id: 'MK-110', title: '商品上架表單', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 2, assigneeId: 'm1' },
      { id: 'MK-112', title: '聊天室訊息列表 UI', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 1, assigneeId: 'm1' },
      { id: 'MK-111', title: '站內聊天 WebSocket 服務', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 1, assigneeId: 'm2' },
      { id: 'MK-108', title: '商品圖片壓縮與上傳', domain: 'BE', state: 'IN_REVIEW', storyPoints: 2, assigneeId: 'm3' },
      { id: 'MK-115', title: '檢舉商品流程', domain: 'FE', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
      { id: 'MK-101', title: '會員註冊與校園信箱驗證', domain: 'BE', state: 'DONE', storyPoints: 5, assigneeId: 'm2' },
      { id: 'MK-102', title: '商品列表與分類篩選', domain: 'FE', state: 'DONE', storyPoints: 5, assigneeId: 'm1' },
      { id: 'MK-104', title: '商品資料表與搜尋 API', domain: 'BE', state: 'DONE', storyPoints: 5, assigneeId: 'm3' },
      { id: 'MK-105', title: '上架流程 UI 設計稿', domain: 'DS', state: 'DONE', storyPoints: 3, assigneeId: 'm4' },
      { id: 'MK-109', title: '聊天室通知推播', domain: 'BE', state: 'IN_REVIEW', storyPoints: 2, assigneeId: 'm2', policy: pool, reviewerId: null },
      { id: 'MK-113', title: '交易評價功能', domain: 'FE', state: 'TODO', storyPoints: 2, assigneeId: 'm4' },
    ],
    sprintName: 'Sprint 4',
    activity: [
      { id: 'mk1', memberId: 'm3', type: 'pr', taskId: 'MK-108', text: '發了 PR #52「商品圖片壓縮與上傳」', time: '40 分鐘前' },
      { id: 'mk2', memberId: 'm2', type: 'pr', taskId: 'MK-109', text: '發了 PR #53「聊天室通知推播」', time: '2 小時前' },
      { id: 'mk3', memberId: 'm1', type: 'claim', taskId: 'MK-112', text: '開始進行 MK-112「聊天室訊息列表 UI」', time: '4 小時前' },
      { id: 'mk4', memberId: 'm4', type: 'done', taskId: 'MK-105', text: '完成了 MK-105「上架流程 UI 設計稿」', time: '昨天' },
      { id: 'mk5', memberId: 'm3', type: 'done', taskId: 'MK-104', text: '完成了 MK-104「商品資料表與搜尋 API」', time: '2 天前' },
    ],
    burndown: burndown(28, [28, 27, 25, 24, 21, 18, 15, 12, 10]),
    planning: { name: 'Sprint 5', states: ['ASSIGNED', 'ASSIGNED', 'ASSIGNED', 'PENDING_MEMBER', 'PENDING_MEMBER', 'RETURNED'] },
  },
  {
    id: 'crawler', short: 'CR', name: '課程評價爬蟲', prefix: 'CR', goal: '建立課程評價資料清洗與搜尋頁',
    done: 6, total: 25, endDate: '2026-12-07', memberCount: 4, inProgress: 4, inReview: 0, action: 3,
    tasks: [
      { id: 'CR-205', title: '課程搜尋頁 UI', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm1' },
      { id: 'CR-204', title: '評價資料清洗腳本', domain: 'DS', state: 'IN_PROGRESS', storyPoints: 5, assigneeId: 'm2' },
      { id: 'CR-206', title: '爬蟲排程與重試機制', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm3' },
      { id: 'CR-207', title: '課程搜尋 API', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm4' },
      { id: 'CR-210', title: '評價情緒分析模型', domain: 'AI', state: 'PENDING_MEMBER', storyPoints: 3, assigneeId: 'm1' },
      { id: 'CR-211', title: '搜尋結果排序規則', domain: 'FE', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
      { id: 'CR-212', title: '搜尋流程 E2E 測試', domain: 'QA', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
      { id: 'CR-201', title: '課程網站爬蟲原型', domain: 'BE', state: 'DONE', storyPoints: 3, assigneeId: 'm3' },
      { id: 'CR-202', title: '評價資料表設計', domain: 'BE', state: 'DONE', storyPoints: 3, assigneeId: 'm4' },
      { id: 'CR-208', title: '課程詳情頁 UI', domain: 'FE', state: 'IN_REVIEW', storyPoints: 2, assigneeId: 'm1', policy: lead, reviewerId: null },
      { id: 'CR-209', title: '關鍵字斷詞與同義詞表', domain: 'AI', state: 'TODO', storyPoints: 3, assigneeId: 'm2' },
    ],
    sprintName: 'Sprint 2',
    activity: [
      { id: 'cr1', memberId: 'm1', type: 'pr', taskId: 'CR-208', text: '發了 PR #18「課程詳情頁 UI」', time: '1 小時前' },
      { id: 'cr2', memberId: 'm4', type: 'claim', taskId: 'CR-207', text: '開始進行 CR-207「課程搜尋 API」', time: '3 小時前' },
      { id: 'cr3', memberId: 'm2', type: 'claim', taskId: 'CR-204', text: '開始進行 CR-204「評價資料清洗腳本」', time: '昨天' },
      { id: 'cr4', memberId: 'm3', type: 'done', taskId: 'CR-201', text: '完成了 CR-201「課程網站爬蟲原型」', time: '3 天前' },
    ],
    burndown: burndown(25, [25, 25, 24, 22, 21, 19]),
    planning: null,
  },
];

interface ProjectState {
  currentId: string;
  setCurrentId: (id: string) => void;
}

/** 目前選中的專案（像 Discord 切換伺服器） */
export const useProjectStore = create<ProjectState>()((set) => ({
  currentId: 'taskline',
  setCurrentId: (currentId) => set({ currentId }),
}));