import { useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { DOMAIN_KEYS, DOMAINS, STORY_POINT_OPTIONS } from '@/lib/constants';
import type { Domain, Member } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

export function ManualTaskDialog({ open, onClose, members }: { open: boolean; onClose: () => void; members: Member[] }) {
  const { createTask } = usePlanningMutations();
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<Domain>('FE');
  const [sp, setSp] = useState(2);
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? '');
  const [ac, setAc] = useState('');

  const submit = () =>
    createTask.mutate(
      {
        title,
        domain,
        storyPoints: sp,
        assigneeId: assigneeId || members[0]?.id || '',
        acceptanceCriteria: ac.split('\n').map((s) => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          setTitle('');
          setAc('');
          onClose();
        },
      },
    );

  return (
    <Modal open={open} onClose={onClose} title="手動新增任務">
      <div className="space-y-4">
        <Field label="標題" htmlFor="mt-title">
          <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <Field label="領域" htmlFor="mt-domain">
            <Select id="mt-domain" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
              {DOMAIN_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DOMAINS[d].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="SP" htmlFor="mt-sp">
            <Select id="mt-sp" value={sp} onChange={(e) => setSp(Number(e.target.value))}>
              {STORY_POINT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="指派" htmlFor="mt-assignee">
          <Select id="mt-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="驗收條件（每行一條）" htmlFor="mt-ac">
          <Textarea id="mt-ac" rows={3} value={ac} onChange={(e) => setAc(e.target.value)} />
        </Field>
        <Button variant="primary" className="w-full" loading={createTask.isPending} onClick={submit}>
          加入草稿
        </Button>
      </div>
    </Modal>
  );
}
