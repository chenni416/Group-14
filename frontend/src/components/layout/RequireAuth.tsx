import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui';
import { useSession } from '@/hooks/useSession';
import { AUTH_ENABLED } from '@/lib/supabase';

/** 未登入時導向登入頁；mock 模式不檢查 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (!AUTH_ENABLED) return children;
  if (loading) return <PageSkeleton />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
