import { NavLink } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { isLead } from '@/lib/permissions';
import { FLOW_NAV, visibleFor } from './nav';
import { TaskSearch } from './TaskSearch';
import { UserSwitcher } from './UserSwitcher';

function Logo() {
  return (
    <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Taskline 首頁">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900">
        <span className="h-3.5 w-3.5 rounded-full border-2 border-white" />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold tracking-tight text-gray-900">taskline</span>
        <span className="block text-[11px] text-gray-600">NYCU ATLAB</span>
      </span>
    </NavLink>
  );
}

export function TopBar() {
  const { data: me } = useCurrentUser();
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 lg:flex-nowrap">
      <Logo />
      <nav aria-label="流程" className="order-3 hidden w-full gap-2 overflow-x-auto lg:order-none lg:ml-4 lg:flex lg:w-auto">
        {visibleFor(FLOW_NAV, isLead(me)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums',
                    isActive ? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600',
                  )}
                >
                  {item.step}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="hidden sm:block">
          <TaskSearch />
        </div>
        <UserSwitcher />
      </div>
      <div className="order-4 w-full sm:hidden">
        <TaskSearch />
      </div>
    </header>
  );
}
