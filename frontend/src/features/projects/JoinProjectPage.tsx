import { Copy, KeyRound, MailOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { useCurrentUser } from '@/hooks/queries';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/cn';
import { JoinCodeForm } from './components/JoinCodeForm';
import { ReceivedInvitations } from './components/ReceivedInvitations';

const STEPS = [
  { title: '向 Leader 取得邀請', text: '索取邀請碼，或把你的 GitHub 帳號告訴 Leader' },
  { title: '輸入邀請碼或接受邀請', text: '在這一頁送出申請，或接受收到的邀請' },
  { title: 'Leader 同意', text: '用邀請碼申請時，需要 Leader 同意' },
  { title: '進入專案', text: '加入後就能看到專案的 Dashboard 與任務' },
];

function IconChip({ icon: Icon, tone }: { icon: typeof KeyRound; tone: string }) {
  return (
    <span className={cn('mb-4 flex h-12 w-12 items-center justify-center rounded-full', tone)}>
      <Icon className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}

/**
 * 加入現有專案：
 * - 輸入 Leader 提供的邀請碼，送出後需要 Leader 同意才會加入
 * - Leader 以 GitHub 帳號直接邀請時，邀請會列在這裡，按接受即加入
 */
export function JoinProjectPage() {
  const { data: me } = useCurrentUser();
  const copy = useCopyToClipboard();
  const login = me?.githubLogin;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader eyebrow="Join Project" title="加入現有專案" />

      <div className="grid flex-1 gap-6 lg:grid-cols-3">
        <Card className="flex flex-col">
          <IconChip icon={KeyRound} tone="bg-orange-50 text-accent-orange" />
          <CardHeader title="輸入邀請碼" description="向專案 Leader 索取邀請碼；送出申請後，Leader 同意就會加入" />
          <JoinCodeForm />
        </Card>

        <Card className="flex flex-col">
          <IconChip icon={MailOpen} tone="bg-sky-50 text-accent-sky" />
          <CardHeader title="收到的邀請" description="Leader 以你的 GitHub 帳號邀請時，會列在這裡" />
          <div className="flex flex-1 flex-col justify-between gap-6">
            <ReceivedInvitations />
            {login && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
                <span className="min-w-0 text-sm text-gray-600">
                  你的 GitHub 帳號
                  <span className="block truncate font-medium text-gray-900">@{login}</span>
                </span>
                <Button size="xs" onClick={() => copy(login, `已複製 @${login}`)}>
                  <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                  複製
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader title="加入流程" description="兩種方式都只需要幾個步驟" />
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                    i === 0 ? 'bg-accent-sky text-white' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  {i + 1}
                </span>
                <span className="pt-1">
                  <span className={cn('block text-sm font-medium', i === 0 ? 'text-gray-900' : 'text-gray-700')}>{s.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-auto pt-6 text-sm text-gray-500">
            想自己建立專案？
            <Link to="/projects/new" className="ml-1 font-medium text-gray-900 underline-offset-4 hover:underline">
              前往建立新專案
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
