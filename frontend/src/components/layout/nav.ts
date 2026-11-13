import { CircleHelp, Inbox, Kanban, Layers, LayoutGrid, Sparkles, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const SIDE_NAV: NavItem[][] = [
  [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/planning', label: 'Sprint 規劃', icon: Sparkles },
    { to: '/inbox', label: '收件匣', icon: Inbox },
    { to: '/board', label: 'Active Board', icon: Kanban },
  ],
  [
    { to: '/onboarding', label: '專案與知識庫', icon: Layers },
    { to: '/team', label: '組織與團隊', icon: Users },
  ],
];

export const HELP_ICON = CircleHelp;

/** 頂部流程切換器 */
export const FLOW_NAV = [
  { to: '/team', label: '團隊設定' },
  { to: '/onboarding', label: '專案初始化' },
  { to: '/planning', label: 'Sprint 規劃' },
  { to: '/inbox', label: '確認與認領' },
  { to: '/board', label: 'Active Board' },
];
