import { CircleHelp, Inbox, Kanban, Layers, LayoutGrid, Sparkles, Users, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const SIDE_NAV: NavItem[][] = [
  [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/sprints', label: 'Sprint 規劃', icon: Sparkles },
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
 * 頂部流程切換器：Planning → Execution → Review → Adaptation。
 * 每個階段對應一組頁面，match 決定目前所在階段；結束 Sprint 後的回顧再回到下一輪 Planning。
 */
export const FLOW_NAV: Array<{ to: string; label: string; hint: string; match: (pathname: string) => boolean }> = [
  { to: '/sprints', label: '規劃', hint: 'Planning', match: (p) => p.startsWith('/sprints') && !p.endsWith('/retro') },
  { to: '/board', label: '執行', hint: 'Execution', match: (p) => p === '/board' },
  { to: '/inbox', label: '審查', hint: 'Review', match: (p) => p === '/inbox' },
  { to: '/retro', label: '調整', hint: 'Adaptation', match: (p) => p === '/retro' || p.endsWith('/retro') },
];
