import { GitBranch, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { AUTH_CALLBACK_PATH, AUTH_CONFIGURED, AUTH_ENABLED, supabase } from '@/lib/supabase';

/** 登入後要回到的頁面（RequireAuth 導向登入頁時帶入），存在 sessionStorage 跨過 GitHub 授權跳轉 */
export const RETURN_TO_KEY = 'taskline.returnTo';

const FEATURES = [
  'AI 從會議紀錄自動拆解任務',
  '依成員專長與負載推薦負責人',
  '一鍵產生 Claude Code 可用的 Prompt',
];

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading: checking } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 已經登入就直接進入主頁
  if (AUTH_ENABLED && !checking && session) return <Navigate to="/" replace />;

  const handleLogin = async () => {
    // mock 模式：假裝連接 GitHub，稍等一下就進入主頁
    if (!AUTH_ENABLED) {
      setLoading(true);
      setTimeout(() => navigate('/'), 900);
      return;
    }
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const from = (location.state as { from?: string } | null)?.from;
    try {
      if (from) sessionStorage.setItem(RETURN_TO_KEY, from);
    } catch {
      // 無法寫入 storage 時登入後回到主頁
    }
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}` },
    });
    // 成功時瀏覽器會跳轉到 GitHub；有錯誤才會停在這裡
    if (err) {
      setLoading(false);
      setError(`無法連接 GitHub：${err.message}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 sm:p-10">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-white" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-gray-900">taskline</span>
            <span className="block text-[11px] text-gray-600">NYCU ATLAB</span>
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">歡迎使用 Taskline</h1>
        <p className="mt-2 text-sm text-gray-500">AI 輔助團隊執行規劃系統，從會議紀錄到交付。</p>

        <ul className="mt-6 space-y-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-sky" />
              {f}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={loading || (AUTH_ENABLED && !AUTH_CONFIGURED)}
          className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-sm font-medium text-white transition-colors duration-150 hover:bg-neutral-700 disabled:cursor-wait disabled:bg-neutral-700"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              正在連接 GitHub…
            </>
          ) : (
            <>
              <GitBranch className="h-4 w-4" strokeWidth={2} />
              以 GitHub 登入
            </>
          )}
        </button>

        {AUTH_ENABLED && !AUTH_CONFIGURED && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            尚未設定 Supabase：請在 frontend/.env.local 填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY 後重新啟動
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-gray-500">
          第一次使用？以 GitHub 登入即會自動建立帳號
        </p>
      </div>
    </div>
  );
}