import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 真正的 GitHub 登入（Supabase Auth）。只有 VITE_USE_MOCK=false 時啟用；
 * mock 模式沿用原本的假登入與身分切換，方便展示。
 */
export const AUTH_ENABLED = import.meta.env.VITE_USE_MOCK === 'false';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** 啟用登入但缺少 Supabase 設定時為 false，登入頁會顯示提示 */
export const AUTH_CONFIGURED = Boolean(url && key);

export const supabase: SupabaseClient | null =
  AUTH_ENABLED && url && key
    ? createClient(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

/** 目前的 access token；沒有登入時為 null（session 快過期時會自動更新） */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** GitHub 授權完成後回到這個網址，由 AuthCallbackPage 完成登入 */
export const AUTH_CALLBACK_PATH = '/auth/callback';
