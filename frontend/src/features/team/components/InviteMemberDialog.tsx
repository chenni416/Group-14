import { useState } from 'react';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { DOMAIN_KEYS, DOMAINS } from '@/lib/constants';
import type { Domain, MemberRole } from '@/types';
import { useTeamMutations } from '../hooks/useTeam';

const EMPTY = { name: '', email: '', role: 'Member' as MemberRole, title: '', domain: 'FE' as Domain, capacity: '8', tags: '' };

export function InviteMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { invite } = useTeamMutations();
  const [form, setForm] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    invite.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        title: form.title.trim() || 'Engineer',
        domain: form.domain,
        capacity: Number(form.capacity) || 8,
        tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="姓名" htmlFor="iv-name">
            <Input id="iv-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="iv-email">
            <Input id="iv-email" type="email" placeholder="name@atlab.tw" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="角色" htmlFor="iv-role">
            <Select id="iv-role" value={form.role} onChange={(e) => set('role', e.target.value as MemberRole)}>
              <option>Member</option>
              <option>PO</option>
              <option>Leader</option>
            </Select>
          </Field>
          <Field label="職稱" htmlFor="iv-title">
            <Input id="iv-title" placeholder="Frontend Engineer" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="主要領域" htmlFor="iv-domain">
            <Select id="iv-domain" value={form.domain} onChange={(e) => set('domain', e.target.value as Domain)}>
              {DOMAIN_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DOMAINS[d].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Capacity (SP)" htmlFor="iv-cap">
            <Input id="iv-cap" type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </Field>
        </div>
        <Field label="技術標籤（逗號分隔）" htmlFor="iv-tags">
          <Input id="iv-tags" placeholder="React, TypeScript" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
        <Button variant="primary" className="w-full" loading={invite.isPending} onClick={submit}>
          送出邀請
        </Button>
      </div>
    </Modal>
  );
}
