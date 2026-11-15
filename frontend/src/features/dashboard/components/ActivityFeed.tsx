import { CircleCheck, Eye, GitPullRequest, Hand, type LucideIcon } from 'lucide-react';
import { Avatar, Card, CardHeader } from '@/components/ui';
import { useMemberMap } from '@/hooks/queries';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';

/** 動態的種類：完成任務、發 PR、完成 Review、認領任務 */
type ActivityType = 'done' | 'pr' | 'review' | 'claim';

interface Activity {
  id: string;
  memberId: string;
  type: ActivityType;
  taskId: string;
  text: string;
  time: string;
}

/** Demo 用的寫死資料：之後串接後端時改成從 API 取得 */
const ACTIVITIES: Activity[] = [
  { id: 'a1', memberId: 'm5', type: 'pr', taskId: 'TL-205', text: '發了 PR #34「通知中心 UI 設計稿」', time: '1 小時前' },
  { id: 'a2', memberId: 'm4', type: 'review', taskId: 'TL-203', text: '認領了 TL-203 的 Code Review', time: '2 小時前' },
  { id: 'a3', memberId: 'm3', type: 'pr', taskId: 'TL-202', text: '發了 PR #31「AI 任務拆解 Prompt 設計」', time: '3 小時前' },
  { id: 'a4', memberId: 'm5', type: 'review', taskId: 'TL-210', text: '通過了 TL-210「看板卡片元件」的審查', time: '5 小時前' },
  { id: 'a5', memberId: 'm2', type: 'done', taskId: 'TL-201', text: '完成了 TL-201「會議紀錄上傳與格式正規化」', time: '昨天' },
  { id: 'a6', memberId: 'm4', type: 'done', taskId: 'TL-206', text: '完成了 TL-206「CI 與 Playwright 測試環境」', time: '昨天' },
  { id: 'a7', memberId: 'm2', type: 'claim', taskId: 'TL-204', text: '開始進行 TL-204「指派推薦演算法服務」', time: '2 天前' },
];

/** 每種動態對應的 icon 與顏色 */
const TYPE_STYLE: Record<ActivityType, { icon: LucideIcon; className: string }> = {
  done: { icon: CircleCheck, className: 'bg-sky-50 text-accent-sky' },
  pr: { icon: GitPullRequest, className: 'bg-violet-50 text-accent-violet' },
  review: { icon: Eye, className: 'bg-orange-50 text-accent-orange' },
  claim: { icon: Hand, className: 'bg-gray-100 text-gray-600' },
};

export function ActivityFeed() {
  const memberMap = useMemberMap();
  const drawer = useTaskDrawer();

  return (
    <Card>
      <CardHeader title="最新動態" description="團隊成員最近的進度" />
      <ul className="divide-y divide-gray-100">
        {ACTIVITIES.map((a) => {
          const member = memberMap.get(a.memberId);
          const { icon: Icon, className } = TYPE_STYLE[a.type];
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => drawer.open(a.taskId)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors duration-150 hover:bg-gray-50"
              >
                <Avatar member={member} size="sm" />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-gray-900">{member?.name ?? '未知成員'}</span>
                  <span className="ml-1.5 text-gray-600">{a.text}</span>
                </div>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${className}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-gray-400">{a.time}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}