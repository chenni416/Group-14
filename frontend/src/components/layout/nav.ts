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

/**
 * 頂部流程切換器：Sprint 規劃 → 確認與認領 → Active Board，圖示與側邊欄相同。
 * 團隊設定與專案初始化屬於一次性的設定，只放在側邊欄。
 */
export const FLOW_NAV: NavItem[] = [
  { to: '/sprints', label: 'Sprint 規劃', icon: Sparkles, leaderOnly: true },
  { to: '/inbox', label: '確認與認領', icon: Inbox },
  { to: '/board', label: 'Active Board', icon: Kanban },
];

export const visibleFor = <T extends { leaderOnly?: boolean }>(items: T[], lead: boolean) =>
  items.filter((i) => lead || !i.leaderOnly);
