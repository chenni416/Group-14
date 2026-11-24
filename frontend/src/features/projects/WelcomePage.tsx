import {
  ArrowRight,
  Check,
  FolderPlus,
  MailOpen,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, PageHeader } from '@/components/ui'
import { useCurrentUser } from '@/hooks/queries'
import { cn } from '@/lib/cn'

const STEPS = [
  { title: '建立或加入專案', text: '建立的人成為 Leader' },
  { title: '邀請成員', text: '用 GitHub 帳號或邀請碼邀請' },
  { title: '上傳會議紀錄、規劃 Sprint', text: 'AI 拆解任務並建議負責人' },
  { title: '連結 GitHub repo', text: '自動同步 PR 與 CI 進度' },
]

/** 兩張選擇卡片格式相同，只有強調色不同 */
const CHOICE_TONE = {
  orange: {
    icon: 'bg-orange-50 text-accent-orange',
    check: 'text-accent-orange',
  },
  sky: { icon: 'bg-sky-50 text-accent-sky', check: 'text-accent-sky' },
}

function Choice({
  to,
  icon: Icon,
  title,
  text,
  points,
  action,
  tone,
}: {
  to: string
  icon: LucideIcon
  title: string
  text: string
  /** 選擇後會經過的步驟 */
  points: string[]
  action: string
  tone: keyof typeof CHOICE_TONE
}) {
  const color = CHOICE_TONE[tone]
  return (
    <Link
      to={to}
      className="group flex h-full flex-col justify-between gap-5 rounded-3xl border border-gray-200 bg-white p-6 transition-colors duration-150 hover:border-gray-900"
    >
      <span className="block">
        <span
          className={cn(
            'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            color.icon,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="block text-xl font-semibold tracking-tight text-gray-900">
          {title}
        </span>
        <span className="mt-1 block text-sm text-gray-500">{text}</span>
        <ul className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          {points.map((p) => (
            <li
              key={p}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <Check
                className={cn('h-4 w-4 shrink-0', color.check)}
                strokeWidth={2}
              />
              {p}
            </li>
          ))}
        </ul>
      </span>
      <span className="flex items-center justify-between rounded-full bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors duration-150 group-hover:bg-gray-900 group-hover:text-white">
        {action}
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
      </span>
    </Link>
  )
}

/** 還沒有任何專案時的首頁：讓使用者選擇建立或加入專案，右側列出開始使用的步驟 */
export function WelcomePage() {
  const { data: me } = useCurrentUser()
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Welcome"
        title={`歡迎使用 Taskline${me ? `，${me.name}` : ''}`}
      />

      <div className="grid flex-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader
            title="你想要怎麼開始？"
            description="還沒有加入任何專案；建立新專案，或用收到的邀請加入現有專案"
          />
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <Choice
              to="/projects/new"
              icon={FolderPlus}
              title="建立新專案"
              text="建立後你會成為專案的 Leader，接著邀請成員加入"
              points={[
                '填寫專案名稱、代碼與目標',
                '上傳專案文件到知識庫',
                '邀請成員、規劃第一個 Sprint',
              ]}
              action="開始建立"
              tone="orange"
            />
            <Choice
              to="/projects/join"
              icon={MailOpen}
              title="我收到了專案邀請"
              text="輸入邀請碼，或接受 Leader 發送至系統的專案邀請"
              points={[
                '輸入 Leader 提供的邀請碼',
                '或接受以你的 GitHub 帳號送出的邀請',
                'Leader 同意後就會加入專案',
              ]}
              action="前往加入"
              tone="sky"
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="開始使用的步驟"
            description="以會議紀錄為起點，完成一次 Sprint"
          />
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    i === 0
                      ? 'bg-accent-sky text-white'
                      : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {i + 1}
                </span>
                <span className="pt-1">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      i === 0 ? 'text-gray-900' : 'text-gray-700',
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {s.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-2xl bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
            之後也可以從左側專案列的「＋」建立或加入其他專案。
          </p>
        </Card>
      </div>
    </div>
  )
}
