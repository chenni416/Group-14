import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, StatusBadge } from '@/components/ui';
import { useMemberMap, useTasks } from '@/hooks/queries';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';

export function TaskSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: tasks } = useTasks();
  const members = useMemberMap();
  const drawer = useTaskDrawer();

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return (tasks ?? [])
      .filter((t) => `${t.id} ${t.title} ${members.get(t.assigneeId)?.name ?? ''}`.toLowerCase().includes(term))
      .slice(0, 7);
  }, [q, tasks, members]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={1.75} />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="搜尋任務、成員"
        aria-label="搜尋任務"
        className="h-10 w-full rounded-full border border-gray-200 bg-white pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
      />
      {open && q.trim() && (
        <div className="absolute right-0 top-12 z-40 w-full min-w-[320px] rounded-2xl border border-gray-100 bg-white p-1.5 shadow-pop">
          {results.length ? (
            results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  drawer.open(t.id);
                  setOpen(false);
                  setQ('');
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-gray-50"
              >
                <Avatar member={members.get(t.assigneeId)} size="xs" />
                <span className="min-w-0 flex-1 truncate">
                  <span className="mr-1.5 font-mono text-xs text-gray-500">{t.id}</span>
                  {t.title}
                </span>
                <StatusBadge state={t.state} />
              </button>
            ))
          ) : (
            <p className="px-3 py-3 text-sm text-gray-500">找不到符合的任務</p>
          )}
        </div>
      )}
    </div>
  );
}
