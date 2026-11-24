import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { takeReturnTo } from '@/lib/authRedirect';
import { supabase } from '@/lib/supabase';
import { api } from '@/services';

/** 從網址讀出 GitHub 或 Supabase 回傳的錯誤（可能在 query 或 hash） */
function readError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const desc = params.get('error_description') ?? hash.get('error_description');
  const code = params.get('error') ?? hash.get('error');
  if (code === 'access_denied') return '你取消了 GitHub 授權';
  return desc ?? code;
}

/** 登入後的去處：還沒有任何專案時一律到首頁（歡迎頁），否則回到登入前的頁面 */
async function landingPath(): Promise<string> {
  const returnTo = takeReturnTo();
  try {
    const projects = await api.workspace.listProjects();
    return projects.length === 0 ? '/' : returnTo;
  } catch {
    return returnTo;
  }
}

/** GitHub 授權完成後回到這裡：Supabase 用網址上的 code 換成 session，完成後進入系統 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(readError);

  useEffect(() => {
    if (error || !supabase) return;
    let active = true;
    // client 初始化時會自動交換 code，getSession 會等交換完成
    void supabase.auth.getSession().then(({ data, error: err }) => {
      if (!active) return;
      if (data.session) {
        void qc.invalidateQueries();
        void landingPath().then((to) => active && navigate(to, { replace: true }));
      } else {
        setError(err?.message ?? '登入沒有完成，請再試一次');
      }
    });
    return () => {
      active = false;
    };
  }, [error, navigate, qc]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center sm:p-10">
        {error ? (
          <>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">登入失敗</h1>
            <p role="alert" className="mt-2 text-sm text-gray-600">
              {error}
            </p>
            <Link
              to="/login"
              replace
              className="mt-6 inline-flex h-10 items-center rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-neutral-700"
            >
              回到登入頁
            </Link>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            正在完成 GitHub 登入…
          </p>
        )}
      </div>
    </div>
  );
}
