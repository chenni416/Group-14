import { Bell, Link2, MessageSquareWarning, UserCheck, CalendarClock, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { AUTH_ENABLED } from '@/lib/supabase';

type NoticeType = 'dependency' | 'blocker' | 'review' | 'meeting';

interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  detail: string;
  time: string;
  /** 點擊後要打開的任務；沒有就只標記已讀 */
  taskId?: string;
}

/** Demo 用的寫死通知：根據 dependency 與自己的任務（只在 mock 模式顯示） */
const DEMO_NOTICES: Notice[] = [
  { id: 'n1', type: 'dependency', title: '前置任務已完成', detail: 'S-211 已完成，你可以開始依賴它的工作', time: '10 分鐘前', taskId: 'S-211' },
  { id: 'n2', type: 'review', title: '有新的審查請求', detail: '李雅婷 請你審查 S-231「通知中心 UI 設計稿」', time: '1 小時前', taskId: 'S-231' },
  { id: 'n3', type: 'blocker', title: '成員回報阻礙', detail: '王思妤 在 S-213 回報：等待 API 規格確認', time: '3 小時前', taskId: 'S-213' },
  { id: 'n4', type: 'meeting', title: 'Sprint 會議提醒', detail: 'Sprint 3 規劃會議將於明天 14:00 開始', time: '昨天' },
];

/** GitHub 登入模式還沒有真正的通知來源，不顯示示範通知（新使用者不應該看到別人的任務） */
const NOTICES: Notice[] = AUTH_ENABLED ? [] : DEMO_NOTICES;

const TYPE_STYLE: Record<NoticeType, { icon: LucideIcon; className: string }> = {
  dependency: { icon: Link2, className: 'bg-sky-50 text-accent-sky' },
  review: { icon: UserCheck, className: 'bg-violet-50 text-accent-violet' },
  blocker: { icon: MessageSquareWarning, className: 'bg-orange-50 text-accent-orange' },
  meeting: { icon: CalendarClock, className: 'bg-gray-100 text-gray-600' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  /** 已讀的通知 id */
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const drawer = useTaskDrawer();

  const unread = NOTICES.filter((n) => !readIds.includes(n.id)).length;

  // 點擊面板外面時自動關閉
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClick = (n: Notice) => {
    setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]));
    if (n.taskId) {
      drawer.open(n.taskId);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="通知"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors duration-150',
          open ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-orange px-1 text-[10px] font-medium tabular-nums text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-gray-100 bg-white p-2 shadow-card">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-semibold text-gray-900">通知</span>
            <button
              type="button"
              onClick={() => setReadIds(NOTICES.map((n) => n.id))}
              className="text-xs text-gray-500 transition-colors duration-150 hover:text-gray-900"
            >
              全部標為已讀
            </button>
          </div>
          {NOTICES.length === 0 && <p className="px-3 pb-4 pt-2 text-sm text-gray-500">目前沒有通知</p>}
          <ul>
            {NOTICES.map((n) => {
              const { icon: Icon, className } = TYPE_STYLE[n.type];
              const isRead = readIds.includes(n.id);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-gray-50"
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', className)}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', isRead ? 'text-gray-500' : 'font-medium text-gray-900')}>
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{n.detail}</span>
                      <span className="mt-1 block text-[11px] text-gray-400">{n.time}</span>
                    </span>
                    {!isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-orange" aria-label="未讀" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}