import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { PageSkeleton } from '@/components/ui';

/** 每個頁面獨立切 chunk，首屏只載入需要的程式碼 */
export const router = createBrowserRouter([
  // 登入頁不需要側邊欄與頂部列，所以放在 AppShell 外面
  { path: 'login', HydrateFallback: PageSkeleton, lazy: () => import('@/features/auth/LoginPage').then((m) => ({ Component: m.LoginPage })) },
  { path: 'auth/callback', HydrateFallback: PageSkeleton, lazy: () => import('@/features/auth/AuthCallbackPage').then((m) => ({ Component: m.AuthCallbackPage })) },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    HydrateFallback: PageSkeleton,
    children: [
      { index: true, lazy: () => import('@/features/dashboard/DashboardPage').then((m) => ({ Component: m.DashboardPage })) },
      { path: 'board', lazy: () => import('@/features/board/BoardPage').then((m) => ({ Component: m.BoardPage })) },
      { path: 'sprints', lazy: () => import('@/features/sprints/SprintListPage').then((m) => ({ Component: m.SprintListPage })) },
      { path: 'sprints/planning', lazy: () => import('@/features/planning/PlanningPage').then((m) => ({ Component: m.PlanningPage })) },
      { path: 'sprints/digest', lazy: () => import('@/features/sprints/DigestPage').then((m) => ({ Component: m.DigestPage })) },
      { path: 'sprints/:id/brief', lazy: () => import('@/features/sprints/BriefPage').then((m) => ({ Component: m.BriefPage })) },
      { path: 'sprints/:id/retro', lazy: () => import('@/features/sprints/RetroPage').then((m) => ({ Component: m.RetroPage })) },
      { path: 'retro', lazy: () => import('@/features/sprints/RetroPage').then((m) => ({ Component: m.RetroPage })) },
      { path: 'planning', element: <Navigate to="/sprints/planning" replace /> },
      { path: 'inbox', lazy: () => import('@/features/inbox/InboxPage').then((m) => ({ Component: m.InboxPage })) },
      { path: 'team', lazy: () => import('@/features/team/TeamPage').then((m) => ({ Component: m.TeamPage })) },
      { path: 'settings', lazy: () => import('@/features/settings/SettingsPage').then((m) => ({ Component: m.SettingsPage })) },
      { path: 'projects/new', lazy: () => import('@/features/projects/CreateProjectPage').then((m) => ({ Component: m.CreateProjectPage })) },
      { path: 'github/callback', lazy: () => import('@/features/projects/GithubCallbackPage').then((m) => ({ Component: m.GithubCallbackPage })) },
      { path: 'projects/join', lazy: () => import('@/features/projects/JoinProjectPage').then((m) => ({ Component: m.JoinProjectPage })) },
      { path: 'onboarding', lazy: () => import('@/features/onboarding/OnboardingPage').then((m) => ({ Component: m.OnboardingPage })) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
