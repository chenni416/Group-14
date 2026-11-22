import { Check, ChevronDown, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui';
import { useCurrentUser, useMembers } from '@/hooks/queries';
import { useSwitchUser } from '@/hooks/useSwitchUser';
import { cn } from '@/lib/cn';
import { AUTH_ENABLED, supabase } from '@/lib/supabase';

/**
 * 右上角的使用者選單：mock 模式可切換示範身分（Leader 與 Member 看到的操作權限不同）；
 * GitHub 登入模式只顯示目前帳號。最下方為登出。
 */
export function UserSwitcher() {
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const switchUser = useSwitchUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 點選單外或按 Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current?.contains(e.target as Node) || setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const logout = async () => {
    setOpen(false);
    if (AUTH_ENABLED && supabase) {
      await supabase.auth.signOut();
      qc.clear();
    }
    navigate('/login', { replace: true });
  };
  const subtitle = me ? (AUTH_ENABLED ? (me.githubLogin ? `@${me.githubLogin}` : me.email) : `${me.role} · ${me.title}`) : '';

  const choose = (id: string) => {
    setOpen(false);
    if (id !== me?.id) switchUser.mutate(id);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="切換身分"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-10 items-center gap-2.5 rounded-full border bg-white pl-1 pr-3 transition-colors duration-150 hover:bg-gray-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
          open ? 'border-gray-900' : 'border-gray-200',
        )}
      >
        <Avatar member={me} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-gray-900">{me?.name ?? '—'}</span>
          <span className="block text-[11px] text-gray-500">{subtitle}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform duration-150', open && 'rotate-180')} strokeWidth={1.75} />
      </button>

      {open && (
        <div role="menu" aria-label="使用者選單" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-pop">
          {AUTH_ENABLED ? (
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Avatar member={me} size="md" />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-gray-900">{me?.name ?? '—'}</span>
                <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>
              </span>
            </div>
          ) : (
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-gray-500">切換身分（示範）</p>
          )}
          {!AUTH_ENABLED && members.map((m) => {
            const active = m.id === me?.id;
            return (
              <button
                key={m.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => choose(m.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150',
                  active ? 'bg-gray-100' : 'hover:bg-gray-50',
                )}
              >
                <Avatar member={m} size="sm" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium text-gray-900">{m.name}</span>
                  <span className="block truncate text-[11px] text-gray-500">
                    {m.role} · {m.title}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-gray-900" strokeWidth={2} />}
              </button>
            );
          })}
          <div className="my-1.5 h-px bg-gray-100" role="separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50">
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </span>
            登出
          </button>
        </div>
      )}
    </div>
  );
}
