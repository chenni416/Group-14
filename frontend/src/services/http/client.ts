import axios, { AxiosError } from 'axios';
import { getAccessToken, supabase } from '@/lib/supabase';
import { useProjectStore } from '@/stores/project.store';
import { ApiError } from '@/types';

/** 一般請求的逾時 */
const DEFAULT_TIMEOUT = 15_000;

/**
 * 會呼叫 AI 的請求要等模型回應：切 Story 約 3–9 秒、Task 拆解（拆 Task + 指派）約 15–25 秒、Sprint 拆解約 25 秒以上。
 * 用一般逾時（15 秒）會在後端還沒做完時就在前端報逾時，所以 AI 請求另外放寬。
 */
export const AI_REQUEST = { timeout: 120_000 } as const;

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: DEFAULT_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// 每個請求帶上 Supabase 登入的 access token
http.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // 目前選擇的專案：後端依此回傳該專案的資料與我在專案中的角色
  const projectId = useProjectStore.getState().currentId;
  if (projectId) config.headers['X-Project-Id'] = projectId;
  return config;
});

/** 後端錯誤格式 {code, message} 統一轉成 ApiError */
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ code?: string; message?: string }>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    // 登入失效（過期或無效）：登出並回到登入頁
    if (status === 401 && supabase && window.location.pathname !== '/login') {
      void supabase.auth.signOut().finally(() => window.location.assign('/login'));
    }
    return Promise.reject(new ApiError(body?.message ?? error.message, status, body?.code ?? 'NETWORK_ERROR'));
  },
);

export const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);
