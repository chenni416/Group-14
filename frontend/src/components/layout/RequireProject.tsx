import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useMyProjects } from '@/hooks/queries';

/** 不需要專案就能使用的頁面 */
const WITHOUT_PROJECT = ['/projects/new', '/settings'];

/** 還沒有任何專案時，導向建立專案頁 */
export function RequireProject({ children }: { children: ReactNode }) {
  const { data: projects } = useMyProjects();
  const { pathname } = useLocation();
  if (projects && projects.length === 0 && !WITHOUT_PROJECT.includes(pathname)) {
    return <Navigate to="/projects/new" replace />;
  }
  return children;
}
