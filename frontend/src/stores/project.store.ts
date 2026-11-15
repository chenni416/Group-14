import { create } from 'zustand';

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
}

export const DEMO_PROJECTS: DemoProject[] = [
  { id: 'taskline', short: 'TL', name: 'Taskline — 會議到交付平台', prefix: 'TL', goal: '', done: 0, total: 0, endDate: '', memberCount: 5, inProgress: 0, inReview: 0, action: 0 },
  { id: 'market', short: 'MK', name: '校園二手平台', prefix: 'MK', goal: '完成商品上架與站內聊天功能', done: 18, total: 24, endDate: '2026-11-30', memberCount: 4, inProgress: 3, inReview: 1, action: 1 },
  { id: 'crawler', short: 'CR', name: '課程評價爬蟲', prefix: 'CR', goal: '建立課程評價資料清洗與搜尋頁', done: 6, total: 20, endDate: '2026-12-07', memberCount: 4, inProgress: 4, inReview: 0, action: 3 },
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