/**
 * 登入後要回到哪個頁面。
 * - 登入逾時被導向登入頁時，記住原本的頁面，重新登入後回到那裡
 * - 主動登出時不記住；還沒有任何專案時一律回到首頁（歡迎頁）
 * 值存在 sessionStorage，才能跨過 GitHub 授權的跳轉；無法使用 storage 時一律回到首頁
 */
const RETURN_TO_KEY = 'taskline.returnTo';
const LOGGED_OUT_KEY = 'taskline.loggedOut';

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // 無法使用 storage：登入後回到首頁
  }
}

/** 主動登出：之後導向登入頁時不記住目前的頁面 */
export function markLoggedOut(): void {
  write(RETURN_TO_KEY, null);
  write(LOGGED_OUT_KEY, '1');
}

/** 是否剛主動登出（RequireAuth 據此決定要不要記住目前的頁面） */
export const justLoggedOut = (): boolean => read(LOGGED_OUT_KEY) === '1';

/** 按下登入時：記住要回到的頁面（沒有就清除），並清除登出標記 */
export function rememberReturnTo(path: string | undefined): void {
  write(LOGGED_OUT_KEY, null);
  write(RETURN_TO_KEY, path && path.startsWith('/') && !path.startsWith('//') ? path : null);
}

/** 登入完成時：取出要回到的頁面並清除；只接受站內路徑 */
export function takeReturnTo(): string {
  const to = read(RETURN_TO_KEY);
  write(RETURN_TO_KEY, null);
  return to && to.startsWith('/') && !to.startsWith('//') ? to : '/';
}
