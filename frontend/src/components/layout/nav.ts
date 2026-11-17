import { CircleHelp, Inbox, Kanban, Layers, LayoutGrid, Sparkles, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** 僅 Leader 可見（Member 端完全隱藏） */
  leaderOnly?: boolean;
}

export const SIDE_NAV: NavItem[][] = [
  [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/sprints', label: 'Sprint', icon: Sparkles },
    { to: '/inbox', label: '收件匣', icon: Inbox },
    { to: '/board', label: 'Active Board', icon: Kanban },
  ],
  [
    { to: '/onboarding', label: '專案與知識庫', icon: Layers },
    { to: '/team', label: '組織與團隊', icon: Users },
  ],
];

export const HELP_ICON = CircleHelp;

/** 頂部流程切換器；step 為固定編號，隱藏項目時其他步驟編號不變 */
export const FLOW_NAV: Array<{ to: string; label: string; step: number; leaderOnly?: boolean }> = [
  { to: '/team', label: '團隊設定', step: 1 },
  { to: '/onboarding', label: '專案初始化', step: 2 },
  { to: '/sprints', label: 'Sprint 規劃', step: 3, leaderOnly: true },
  { to: '/inbox', label: '確認與認領', step: 4 },
  { to: '/board', label: 'Active Board', step: 5 },
];

export const visibleFor = <T extends { leaderOnly?: boolean }>(items: T[], lead: boolean) =>
  items.filter((i) => lead || !i.leaderOnly);
