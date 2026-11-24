import { Copy, RefreshCw, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CardHeader, IconButton, Input } from '@/components/ui';
import { toast } from '@/stores/toast.store';

/** GitHub 帳號：英數字與連字號，不能以連字號開頭，最長 39 字 */
const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(prefix: string) {
  const values = crypto.getRandomValues(new Uint32Array(8));
  const chars = [...values].map((v) => CODE_CHARS[v % CODE_CHARS.length]).join('');
  return `${prefix || 'TEAM'}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * 建立新專案的最後一步：用 GitHub 帳號邀請，或產生團隊邀請碼。
 * 目前只有介面，名單與邀請碼存在畫面上，之後接上邀請 API。
 */
export function InviteMembersStep({ prefix }: { prefix: string }) {
  const [login, setLogin] = useState('');
  const [invited, setInvited] = useState<string[]>([]);
  const [code, setCode] = useState<string | null>(null);

  const value = login.trim().replace(/^@/, '');
  const invalid = value !== '' && !GITHUB_LOGIN.test(value);
  const add = () => {
    if (!value || invalid) return;
    if (invited.some((x) => x.toLowerCase() === value.toLowerCase())) return toast(`已經邀請 @${value}`);
    setInvited((list) => [...list, value]);
    setLogin('');
    toast(`已加入邀請名單：@${value}`);
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast('已複製邀請碼');
    } catch {
      toast('無法複製，請手動選取邀請碼');
    }
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="以 GitHub 帳號邀請" description="對方用 GitHub 登入 Taskline 後，就會在通知看到邀請" />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            aria-label="GitHub 帳號"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="GitHub 帳號，例如 octocat"
            className="font-mono"
            aria-invalid={invalid}
          />
          <Button type="submit" variant="primary" disabled={!value || invalid}>
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            邀請
          </Button>
        </form>
        {invalid && <p className="mt-1.5 text-xs text-red-600">GitHub 帳號只能包含英文、數字與連字號</p>}

        <div className="mt-4 text-xs text-gray-500">邀請名單（{invited.length}）</div>
        {invited.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">還沒有邀請任何人</p>
        ) : (
          <div className="mt-1 max-h-52 divide-y divide-gray-100 overflow-y-auto">
            {invited.map((name) => (
              <div key={name} className="flex items-center gap-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium uppercase text-gray-600">
                  {name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">@{name}</span>
                <Badge tone="orange" dot>
                  等待接受
                </Badge>
                <IconButton aria-label={`取消邀請 ${name}`} size="sm" variant="ghost" onClick={() => setInvited((l) => l.filter((x) => x !== name))}>
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="團隊邀請碼" description="把邀請碼傳給成員，對方在「加入專案」輸入後，經 Leader 核准即可加入" />
        {code ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-4">
              <span className="font-mono text-xl tracking-widest text-gray-900" aria-label="團隊邀請碼">
                {code}
              </span>
              <Button size="sm" onClick={() => void copy()}>
                <Copy className="h-4 w-4" strokeWidth={1.75} />
                複製
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">重新產生後，舊的邀請碼會失效</span>
              <Button size="sm" variant="ghost" onClick={() => setCode(randomCode(prefix))}>
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                重新產生
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" onClick={() => setCode(randomCode(prefix))}>
            產生邀請碼
          </Button>
        )}
      </Card>
    </div>
  );
}
