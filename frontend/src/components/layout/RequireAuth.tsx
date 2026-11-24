import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { justLoggedOut } from '@/lib/authRedirect';
import { AUTH_ENABLED } from '@/lib/supabase';

/** 未登入時導向登入頁，並記住原本的頁面（主動登出時不記住）；mock 模式不檢查 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (!AUTH_ENABLED) return children;
  if (loading) return <PageSkeleton />;
  if (!session) {
    const from = justLoggedOut() ? undefined : location.pathname + location.search;
    return <Navigate to="/login" replace state={from ? { from } : undefined} />;
  }
  return children;
}
