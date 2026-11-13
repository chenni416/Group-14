import axios, { AxiosError } from 'axios';
import { ApiError } from '@/types';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'taskline.token';

http.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // 無法讀取 storage 時以未登入狀態送出
  }
  return config;
});

/** 後端錯誤格式 {code, message} 統一轉成 ApiError */
http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ code?: string; message?: string }>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    return Promise.reject(new ApiError(body?.message ?? error.message, status, body?.code ?? 'NETWORK_ERROR'));
  },
);

export const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data);
