import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { useCurrentUser, useNotifications } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { isLead } from '@/lib/permissions';
import { HELP_ICON, SIDE_NAV, visibleFor, type NavItem } from './nav';

const itemClass = (active: boolean) =>
  cn(
    'group relative flex h-10 w-10 items-center md:h-11 md:w-11 justify-center rounded-full transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
    active ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900',
  );

function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-20 ml-3 hidden whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1.5 text-xs text-white group-hover:md:block">
      {label}
    </span>
  );
}

function Item({ item, badge }: { item: NavItem; badge?: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.to === '/'} aria-label={item.label} className={({ isActive }) => itemClass(isActive)}>
      <Icon className="h-5 w-5" strokeWidth={1.75} />
      {badge && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-orange ring-2 ring-white" />}
      <Tip label={item.label} />
    </NavLink>
  );
}

/** 極簡垂直膠囊 Icon 選單，位於 Logo 正下方；手機寬度改為主工作區下方的水平列 */
export function SideNav({ onHelp }: { onHelp: () => void }) {
  const { data: notifications } = useNotifications();
  const { data: me } = useCurrentUser();
  const lead = isLead(me);
  const pending = notifications?.some((n) => n.status === 'pending') ?? false;

  return (
    <nav
      aria-label="主選單"
      className={cn(
        'z-30 flex items-center gap-1 rounded-full md:gap-2 border border-gray-100 bg-white p-2 shadow-card',
        'shrink-0 justify-between',
        'md:flex-col md:justify-start md:self-start',
      )}
    >
      {SIDE_NAV.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className="hidden h-px w-6 bg-gray-200 md:my-1 md:block" aria-hidden />}
          {visibleFor(group, lead).map((item) => (
            <Item key={item.to} item={item} badge={item.to === '/inbox' && pending} />
          ))}
        </Fragment>
      ))}
      <span className="hidden h-px w-6 bg-gray-200 md:my-1 md:block" aria-hidden />
      <button type="button" aria-label="流程說明" onClick={onHelp} className={itemClass(false)}>
        <HELP_ICON className="h-5 w-5" strokeWidth={1.75} />
        <Tip label="流程說明" />
      </button>
    </nav>
  );
}
