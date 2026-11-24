import { useState } from 'react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { DOMAIN_KEYS, DOMAINS } from '@/lib/constants';
import type { Domain, MemberRole } from '@/types';
import { useTeamMutations } from '../hooks/useTeam';

const EMPTY = { githubLogin: '', role: 'Member' as MemberRole, title: '', domain: '' as Domain | '', capacity: '8' };

/** 用 GitHub 帳號邀請成員：不寄信，對方以 GitHub 登入後在「加入專案」頁接受 */
export function InviteMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { createInvitation } = useTeamMutations();
  const [form, setForm] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const login = form.githubLogin.trim().replace(/^@/, '');

  const submit = () =>
    createInvitation.mutate(
      {
        githubLogin: login,
        role: form.role,
        title: form.title.trim(),
        domain: form.domain || null,
        capacity: Number(form.capacity) || 0,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          onClose();
        },
      },
    );

  return (
    <Modal open={open} onClose={onClose} title="邀請成員">
      <div className="space-y-4">
        <Field label="GitHub 帳號" htmlFor="iv-login">
          <div className="flex items-center gap-3">
            {/* 頭像來自 GitHub，用來確認帳號沒打錯 */}
            {login && (
              <img
                src={`https://github.com/${encodeURIComponent(login)}.png?size=64`}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full bg-gray-100"
              />
            )}
            <Input
              id="iv-login"
              placeholder="例如：octocat"
              value={form.githubLogin}
              onChange={(e) => set('githubLogin', e.target.value)}
              autoFocus
            />
          </div>
        </Field>
        <p className="text-xs text-gray-500">不會寄信：對方用這個 GitHub 帳號登入後，會在「加入專案」頁看到邀請。</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="加入後的角色" htmlFor="iv-role">
            <Select id="iv-role" value={form.role} onChange={(e) => set('role', e.target.value as MemberRole)}>
              <option>Member</option>
              <option>Leader</option>
            </Select>
          </Field>
          <Field label="職稱（選填）" htmlFor="iv-title">
            <Input id="iv-title" placeholder="Frontend Engineer" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="主要領域（選填）" htmlFor="iv-domain">
            <Select id="iv-domain" value={form.domain} onChange={(e) => set('domain', e.target.value as Domain | '')}>
              <option value="">之後再設定</option>
              {DOMAIN_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DOMAINS[d].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capacity (SP)" htmlFor="iv-cap">
            <Input id="iv-cap" type="number" min={0} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </Field>
        </div>
        {form.role === 'Leader' && (
          <p className="text-xs text-accent-orange">一個專案只有一位 Leader：對方接受後，你會改為 Member。</p>
        )}
        <Button variant="primary" className="w-full" disabled={!login} loading={createInvitation.isPending} onClick={submit}>
          送出邀請
        </Button>
      </div>
    </Modal>
  );
}
