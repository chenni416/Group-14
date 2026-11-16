import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui';
import { useCurrentUser } from '@/hooks/queries';
import { isLead } from '@/lib/permissions';
import { toast } from '@/stores/toast.store';

/** Leader 專屬頁面：Member 直接存取時提示無權限並導向確認與認領 */
export function RequireLeader({ children, redirectTo = '/inbox' }: { children: ReactNode; redirectTo?: string }) {
  const { data: me, isLoading } = useCurrentUser();
  const denied = !isLoading && !!me && !isLead(me);

  useEffect(() => {
    if (denied) toast('你沒有 Sprint 規劃的權限，已導向確認與認領');
  }, [denied]);

  if (isLoading || !me) return <PageSkeleton />;
  if (denied) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
