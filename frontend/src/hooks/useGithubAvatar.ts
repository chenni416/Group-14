import { useEffect, useState } from 'react';

/** GitHub 帳號：英數字與連字號，不能以連字號開頭，最長 39 字 */
export const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export const githubAvatarUrl = (login: string, size = 64) => `https://github.com/${encodeURIComponent(login)}.png?size=${size}`;

export type GithubAvatarStatus = 'idle' | 'loading' | 'found' | 'missing';

/**
 * 輸入 GitHub 帳號時預覽頭像，用來確認帳號存在、沒有打錯。
 * 停止輸入一小段時間才載入；頭像載入失敗（GitHub 回 404）代表帳號不存在。
 * 只是輔助確認，送出邀請時後端還會再向 GitHub 檢查一次。
 */
export function useGithubAvatar(login: string, delay = 400) {
  const valid = GITHUB_LOGIN.test(login);
  const [result, setResult] = useState<{ login: string; status: 'found' | 'missing' } | null>(null);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const img = new Image();
      img.onload = () => !cancelled && setResult({ login, status: 'found' });
      img.onerror = () => !cancelled && setResult({ login, status: 'missing' });
      img.src = githubAvatarUrl(login);
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [login, valid, delay]);

  // 結果只屬於當時查詢的帳號；帳號改了就回到載入中
  const status: GithubAvatarStatus = !valid ? 'idle' : result?.login === login ? result.status : 'loading';
  return { status, src: status === 'found' ? githubAvatarUrl(login) : null };
}

/** 頭像預覽下方的說明文字 */
export function githubAvatarHint(status: GithubAvatarStatus, login: string) {
  if (status === 'found') return { tone: 'muted' as const, text: `請確認用戶帳號為 @${login}` };
  if (status === 'missing') return { tone: 'error' as const, text: `GitHub 上找不到 @${login}，請確認帳號是否正確` };
  return null;
}
