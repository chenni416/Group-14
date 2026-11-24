import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Link2, MailOpen, MessageSquareWarning, UserCheck, Users, CalendarClock, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { queryKeys } from '@/lib/queryKeys';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { AUTH_ENABLED } from '@/lib/supabase';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import type { Notification } from '@/types';

type NoticeType = 'dependency' | 'blocker' | 'review' | 'meeting' | 'invite' | 'team';

interface Notice {
  id: string;
  type: NoticeType;
  title: string;
  detail: string;
  time: string;
  /** 點擊後要打開的任務；沒有就只標記已讀 */
  taskId?: string;
  /** 點擊後要前往的頁面與專案（資料庫的通知） */
  link?: string | null;
  projectId?: string | null;
  read?: boolean;
}

/** Demo 用的寫死通知：根據 dependency 與自己的任務（只在 mock 模式顯示） */
const DEMO_NOTICES: Notice[] = [
  { id: 'n1', type: 'dependency', title: '前置任務已完成', detail: 'S-211 已完成，你可以開始依賴它的工作', time: '10 分鐘前', taskId: 'S-211' },
  { id: 'n2', type: 'review', title: '有新的審查請求', detail: '李雅婷 請你審查 S-231「通知中心 UI 設計稿」', time: '1 小時前', taskId: 'S-231' },
  { id: 'n3', type: 'blocker', title: '成員回報阻礙', detail: '王思妤 在 S-213 回報：等待 API 規格確認', time: '3 小時前', taskId: 'S-213' },
  { id: 'n4', type: 'meeting', title: 'Sprint 會議提醒', detail: 'Sprint 3 規劃會議將於明天 14:00 開始', time: '昨天' },
];

/** 資料庫的通知轉成畫面用的格式：邀請（type = invite）與團隊加入的動態（type = info） */
function toNotice(n: Notification): Notice {
  const invite = n.type === 'invite';
  return {
    id: n.id,
    type: invite ? 'invite' : 'team',
    title: invite ? '專案邀請' : '團隊動態',
    detail: n.text,
    time: relativeTime(n.createdAt),
    link: n.link,
    projectId: n.projectId,
    read: n.status === 'done',
  };
}

const TYPE_STYLE: Record<NoticeType, { icon: LucideIcon; className: string }> = {
  dependency: { icon: Link2, className: 'bg-sky-50 text-accent-sky' },
  review: { icon: UserCheck, className: 'bg-violet-50 text-accent-violet' },
  blocker: { icon: MessageSquareWarning, className: 'bg-orange-50 text-accent-orange' },
  meeting: { icon: CalendarClock, className: 'bg-gray-100 text-gray-600' },
  invite: { icon: MailOpen, className: 'bg-sky-50 text-accent-sky' },
  team: { icon: Users, className: 'bg-violet-50 text-accent-violet' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  /** 示範通知的已讀 id（只存在畫面上） */
  const [readIds, setReadIds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const drawer = useTaskDrawer();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { currentId, setCurrentId } = useProjectStore();

  // GitHub 登入時讀資料庫的通知，每分鐘更新一次；示範模式用寫死的通知
  const { data } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: api.notifications.list,
    enabled: AUTH_ENABLED,
    refetchInterval: 60_000,
  });
  const NOTICES: Notice[] = AUTH_ENABLED ? (data ?? []).map(toNotice) : DEMO_NOTICES;
  const isRead = (n: Notice) => (AUTH_ENABLED ? Boolean(n.read) : readIds.includes(n.id));
  const unread = NOTICES.filter((n) => !isRead(n)).length;
  const refresh = () => qc.invalidateQueries({ queryKey: queryKeys.notifications });

  // 點擊面板外面時自動關閉
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleClick = async (n: Notice) => {
    if (!AUTH_ENABLED) {
      setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]));
      if (n.taskId) {
        drawer.open(n.taskId);
        setOpen(false);
      }
      return;
    }
    if (!n.read) {
      await api.notifications.markRead(n.id);
      void refresh();
    }
    if (!n.link) return;
    setOpen(false);
    // 通知屬於別的專案：先切換專案，所有資料重新讀取
    if (n.projectId && n.projectId !== currentId) {
      setCurrentId(n.projectId);
      await qc.invalidateQueries();
    }
    navigate(n.link);
  };

  const markAll = async () => {
    if (!AUTH_ENABLED) return setReadIds(NOTICES.map((n) => n.id));
    await api.notifications.markAllRead();
    void refresh();
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
              onClick={() => void markAll()}
              className="text-xs text-gray-500 transition-colors duration-150 hover:text-gray-900"
            >
              全部標為已讀
            </button>
          </div>
          {NOTICES.length === 0 && <p className="px-3 pb-4 pt-2 text-sm text-gray-500">目前沒有通知</p>}
          <ul>
            {NOTICES.map((n) => {
              const { icon: Icon, className } = TYPE_STYLE[n.type];
              const read = isRead(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleClick(n)}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-gray-50"
                  >
                    <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', className)}>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', read ? 'text-gray-500' : 'font-medium text-gray-900')}>
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">{n.detail}</span>
                      <span className="mt-1 block text-[11px] text-gray-400">{n.time}</span>
                    </span>
                    {!read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent-orange" aria-label="未讀" />}
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