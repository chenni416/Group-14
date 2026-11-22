import axios, { AxiosError } from 'axios';
import { getAccessToken, supabase } from '@/lib/supabase';
import { ApiError } from '@/types';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// 每個請求帶上 Supabase 登入的 access token
http.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
