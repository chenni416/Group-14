import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui';
import { NoProjectState } from '@/features/projects/components/NoProjectState';
import { WelcomePage } from '@/features/projects/WelcomePage';
import { useMyProjects } from '@/hooks/queries';

/** 不需要專案就能使用的頁面 */
const WITHOUT_PROJECT = ['/projects/new', '/projects/join', '/settings'];

/**
 * 還沒有任何專案時：首頁改為歡迎頁，其他需要專案的頁面顯示「尚未加入專案」。
 * 側邊欄與頂部列照常顯示，所有功能都可以點，不會被強制導向。
 */
export function RequireProject({ children }: { children: ReactNode }) {
  const { data: projects, isPending } = useMyProjects();
  const { pathname } = useLocation();
  if (WITHOUT_PROJECT.includes(pathname)) return children;
  if (isPending) return <PageSkeleton />;
  if (projects && projects.length === 0) return pathname === '/' ? <WelcomePage /> : <NoProjectState />;
  return children;
}
