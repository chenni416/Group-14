import { clone, delay } from '@/mocks/db';

/** 模擬非同步 API：延遲後回傳深拷貝，避免 UI 直接改到 mock 資料 */
export async function respond<T>(fn: () => T, ms?: number): Promise<T> {
  await delay(ms);
  return clone(fn());
}
