import { useState } from 'react';
import { Button, Field, Input, Modal } from '@/components/ui';
import { githubAvatarHint, useGithubAvatar } from '@/hooks/useGithubAvatar';
import { useTeamMutations } from '../hooks/useTeam';
import { GithubAvatarPreview } from './GithubAvatarPreview';
import { JoinCodeSection } from './JoinCodeSection';

/**
 * 邀請成員：上半部用 GitHub 帳號邀請（不寄信，對方以 GitHub 登入後在「加入專案」頁接受），
 * 下半部為專案邀請碼。角色預設為 Member，職稱、領域與 Capacity 在成員加入後到成員卡片設定。
 */
export function InviteMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createInvitation } = useTeamMutations();
  const [githubLogin, setGithubLogin] = useState('');
  const login = githubLogin.trim().replace(/^@/, '');
  const avatar = useGithubAvatar(login);
  const hint = githubAvatarHint(avatar.status, login);

  const submit = () =>
    createInvitation.mutate({ githubLogin: login }, { onSuccess: () => setGithubLogin('') });

  return (
    <Modal open={open} onClose={onClose} title="邀請成員">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (login) submit();
        }}
      >
        <Field label="GitHub 帳號" htmlFor="iv-login">
          <div className="flex items-center gap-3">
            {/* 頭像來自 GitHub，用來確認帳號存在、沒有打錯 */}
            <GithubAvatarPreview {...avatar} />
            <Input id="iv-login" placeholder="例如：octocat" value={githubLogin} onChange={(e) => setGithubLogin(e.target.value)} autoFocus />
            <Button type="submit" variant="primary" className="shrink-0" disabled={!login} loading={createInvitation.isPending}>
              送出邀請
            </Button>
          </div>
        </Field>
        {hint && <p className={hint.tone === 'error' ? 'text-xs text-red-600' : 'text-xs text-gray-500'}>{hint.text}</p>}
        <p className="text-xs text-gray-500">不會寄信：對方用這個 GitHub 帳號登入後，會在「加入專案」頁看到邀請。</p>
      </form>
      <div className="mt-6 border-t border-gray-100 pt-5">
        <JoinCodeSection />
      </div>
    </Modal>
  );
}
