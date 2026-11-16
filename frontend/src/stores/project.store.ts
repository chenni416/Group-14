import { create } from 'zustand';
import type { Domain, TaskState } from '@/types';

/** 示意專案的任務：只保留「我的任務」需要的欄位 */
export interface DemoTask {
  id: string;
  title: string;
  domain: Domain;
  state: TaskState;
  storyPoints: number;
  assigneeId: string;
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
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'taskline', short: 'TL', name: 'Taskline — 會議到交付平台', prefix: 'TL', goal: '',
    done: 0, total: 0, endDate: '', memberCount: 5, inProgress: 0, inReview: 0, action: 0,
    tasks: [],
  },
  {
    id: 'market', short: 'MK', name: '校園二手平台', prefix: 'MK', goal: '完成商品上架與站內聊天功能',
    done: 18, total: 24, endDate: '2026-11-30', memberCount: 4, inProgress: 3, inReview: 1, action: 1,
    tasks: [
      { id: 'MK-110', title: '商品上架表單', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 2, assigneeId: 'm1' },
      { id: 'MK-112', title: '聊天室訊息列表 UI', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 1, assigneeId: 'm1' },
      { id: 'MK-111', title: '站內聊天 WebSocket 服務', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 1, assigneeId: 'm2' },
      { id: 'MK-108', title: '商品圖片壓縮與上傳', domain: 'BE', state: 'IN_REVIEW', storyPoints: 2, assigneeId: 'm3' },
      { id: 'MK-115', title: '檢舉商品流程', domain: 'FE', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
    ],
  },
  {
    id: 'crawler', short: 'CR', name: '課程評價爬蟲', prefix: 'CR', goal: '建立課程評價資料清洗與搜尋頁',
    done: 6, total: 20, endDate: '2026-12-07', memberCount: 4, inProgress: 4, inReview: 0, action: 3,
    tasks: [
      { id: 'CR-205', title: '課程搜尋頁 UI', domain: 'FE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm1' },
      { id: 'CR-204', title: '評價資料清洗腳本', domain: 'DS', state: 'IN_PROGRESS', storyPoints: 5, assigneeId: 'm2' },
      { id: 'CR-206', title: '爬蟲排程與重試機制', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm3' },
      { id: 'CR-207', title: '課程搜尋 API', domain: 'BE', state: 'IN_PROGRESS', storyPoints: 3, assigneeId: 'm4' },
      { id: 'CR-210', title: '評價情緒分析模型', domain: 'AI', state: 'PENDING_MEMBER', storyPoints: 3, assigneeId: 'm1' },
      { id: 'CR-211', title: '搜尋結果排序規則', domain: 'FE', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
      { id: 'CR-212', title: '搜尋流程 E2E 測試', domain: 'QA', state: 'PENDING_MEMBER', storyPoints: 2, assigneeId: 'm1' },
    ],
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