import { Copy, RefreshCw, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, CardHeader, IconButton, Input } from '@/components/ui';
import { GithubAvatarPreview } from '@/features/team/components/GithubAvatarPreview';
import { useTeamMutations } from '@/features/team/hooks/useTeam';
import { GITHUB_LOGIN, githubAvatarHint, githubAvatarUrl, useGithubAvatar } from '@/hooks/useGithubAvatar';
import { useInvitations, useJoinCode } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';

/**
 * 建立新專案的最後一步：用 GitHub 帳號邀請，或產生團隊邀請碼。
 * 與團隊頁使用同一組邀請 API：邀請存在 project_invitations，邀請碼存在 project_join_codes。
 */
export function InviteMembersStep() {
  const [login, setLogin] = useState('');
  const { data: invitations } = useInvitations();
  const { data: code } = useJoinCode();
  const { createInvitation, revokeInvitation } = useTeamMutations();
  const copy = useCopyToClipboard();

  const createCode = useApiMutation({
    mutationFn: () => api.joinCodes.create({ expiresInDays: 7 }),
    invalidate: [['join-codes']],
    onSuccess: (c) => toast(`已產生邀請碼 ${c.code}`),
  });

  const pending = (invitations ?? []).filter((i) => i.status === 'pending');
  const value = login.trim().replace(/^@/, '');
  const invalid = value !== '' && !GITHUB_LOGIN.test(value);
  const avatar = useGithubAvatar(value);
  const hint = githubAvatarHint(avatar.status, value);
  const add = () => {
    if (!value || invalid) return;
    createInvitation.mutate({ githubLogin: value }, { onSuccess: () => setLogin('') });
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="以 GitHub 帳號邀請" description="對方用 GitHub 登入 Taskline 後，會在「加入專案」頁看到邀請" />
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          {/* 頭像來自 GitHub，用來確認帳號存在、沒有打錯 */}
          <GithubAvatarPreview {...avatar} />
          <Input
            aria-label="GitHub 帳號"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="GitHub 帳號，例如 octocat"
            className="font-mono"
            aria-invalid={invalid}
          />
          <Button type="submit" variant="primary" disabled={!value || invalid} loading={createInvitation.isPending}>
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            邀請
          </Button>
        </form>
        {invalid ? (
          <p className="mt-1.5 text-xs text-red-600">GitHub 帳號只能包含英文、數字與連字號</p>
        ) : (
          hint && <p className={hint.tone === 'error' ? 'mt-1.5 text-xs text-red-600' : 'mt-1.5 text-xs text-gray-500'}>{hint.text}</p>
        )}

        <div className="mt-4 text-xs text-gray-500">邀請名單（{pending.length}）</div>
        {pending.length === 0 ? (
          <p className="mt-2 rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">還沒有邀請任何人</p>
        ) : (
          <div className="mt-1 max-h-52 divide-y divide-gray-100 overflow-y-auto">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-2">
                <img
                  src={githubAvatarUrl(inv.githubLogin)}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full bg-gray-100"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">@{inv.githubLogin}</span>
                <Badge tone="orange" dot>
                  等待接受
                </Badge>
                <IconButton
                  aria-label={`取消邀請 ${inv.githubLogin}`}
                  size="sm"
                  variant="ghost"
                  disabled={revokeInvitation.isPending}
                  onClick={() => revokeInvitation.mutate(inv)}
                >
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
                {code.code}
              </span>
              <Button size="sm" onClick={() => copy(code.code, '已複製邀請碼')}>
                <Copy className="h-4 w-4" strokeWidth={1.75} />
                複製
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">
                {code.expiresAt ? `${new Date(code.expiresAt).toLocaleDateString('zh-TW')} 過期・` : ''}
                重新產生後，舊的邀請碼會失效
              </span>
              <Button size="sm" variant="ghost" loading={createCode.isPending} onClick={() => createCode.mutate()}>
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                重新產生
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" loading={createCode.isPending} onClick={() => createCode.mutate()}>
            產生邀請碼
          </Button>
        )}
        <p className="mt-4 text-xs text-gray-500">申請加入的成員會出現在「組織與團隊」頁，由 Leader 同意或拒絕。</p>
      </Card>
    </div>
  );
}
