import { api } from '@/services';

/**
 * 連結 GitHub repo：前往 GitHub App 安裝頁，安裝完成後 GitHub 會帶著參數回到 /github/callback。
 * 跳轉後整個頁面會重新載入，所以把「完成後要回到哪裡」存在 sessionStorage。
 */
export type GithubReturn = 'onboarding' | 'team';
const RETURN_KEY = 'taskline.githubReturn';

export async function startGithubLink(returnTo: GithubReturn): Promise<void> {
  const { url } = await api.github.installUrl();
  try {
    sessionStorage.setItem(RETURN_KEY, returnTo);
  } catch {
    // 無法使用 storage：完成後回到團隊設定
  }
  window.location.assign(url);
}

/** 讀取完成後要回到哪裡（只讀不刪：React 開發模式會重複執行初始化，刪除交給 clearGithubReturn） */
export function peekGithubReturn(): GithubReturn {
  try {
    return sessionStorage.getItem(RETURN_KEY) === 'onboarding' ? 'onboarding' : 'team';
  } catch {
    return 'team';
  }
}

export function clearGithubReturn(): void {
  try {
    sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // 無法使用 storage
  }
}
