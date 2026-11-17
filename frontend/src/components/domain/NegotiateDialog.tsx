import { useState } from 'react';
import { Button, Field, Modal, SegmentedControl, Select, Textarea } from '@/components/ui';
import { useMembers } from '@/hooks/queries';
import { useTaskActions } from '@/hooks/useTaskActions';
import { NEGOTIATE_TARGETS } from '@/lib/constants';
import type { NegotiateTarget, Task } from '@/types';

const QUICK_REASONS = ['本週時間不足', '不熟悉此技術', '與其他任務衝突'];

export function NegotiateDialog({ task, open, onClose }: { task: Task | null; open: boolean; onClose: () => void }) {
  const { data: members } = useMembers();
  const { negotiate } = useTaskActions();
  const [reason, setReason] = useState('');
  const [suggestId, setSuggestId] = useState('');
  const [target, setTarget] = useState<NegotiateTarget>('points');

  if (!task) return null;

  const submit = () =>
    negotiate.mutate(
      { id: task.id, input: { reason, suggestId: suggestId || null, target } },
      {
        onSuccess: () => {
          setReason('');
          setSuggestId('');
          onClose();
        },
      },
    );

  return (
    <Modal open={open} onClose={onClose} title="協商轉移 / 拒絕" description={`${task.id} · ${task.title} · ${task.storyPoints} SP`}>
      <div className="space-y-4">
        <Field label="想協商的項目">
          <SegmentedControl<NegotiateTarget>
            size="sm"
            aria-label="協商項目"
            value={target}
            onChange={setTarget}
            options={(Object.keys(NEGOTIATE_TARGETS) as NegotiateTarget[]).map((k) => ({ value: k, label: NEGOTIATE_TARGETS[k] }))}
          />
        </Field>
        <Field label="原因（會通知 Leader）" htmlFor="ng-reason">
          <div className="mb-2 flex flex-wrap gap-2">
            {QUICK_REASONS.map((r) => (
              <Button key={r} size="xs" onClick={() => setReason(r)}>
                {r}
              </Button>
            ))}
          </div>
          <Textarea
            id="ng-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例如：本週有期中考，建議改由林柏翰處理"
          />
        </Field>
        <Field label="建議人選（選填）" htmlFor="ng-suggest">
          <Select id="ng-suggest" value={suggestId} onChange={(e) => setSuggestId(e.target.value)}>
            <option value="">不指定</option>
            {members
              ?.filter((m) => m.id !== task.assigneeId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.title}
                </option>
              ))}
          </Select>
        </Field>
        <Button variant="primary" className="w-full" loading={negotiate.isPending} onClick={submit}>
          送出並退回 Leader
        </Button>
      </div>
    </Modal>
  );
}
