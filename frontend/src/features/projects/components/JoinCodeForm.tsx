import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { useMyJoinRequests } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { JoinRequest } from '@/types';

/** 輸入邀請碼送出加入申請，並列出等待 Leader 同意的申請 */
export function JoinCodeForm() {
  const [code, setCode] = useState('');
  const { data: requests } = useMyJoinRequests();

  const submit = useApiMutation({
    mutationFn: () => api.joinCodes.submit(code.trim()),
    invalidate: [['join-requests', 'mine']],
    onSuccess: (r) => {
      setCode('');
      toast(`已送出申請，等待「${r.projectName}」的 Leader 同意`);
    },
  });
  const cancel = useApiMutation({
    mutationFn: (r: JoinRequest) => api.joinCodes.cancel(r.id),
    invalidate: [['join-requests', 'mine']],
    onSuccess: (_, r) => toast(`已取消加入「${r.projectName}」的申請`),
  });

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="space-y-4">
        <Field label="邀請碼" htmlFor="join-code">
          <Input
            id="join-code"
            placeholder="例如：TL-7K2QX9"
            className="font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && code.trim() && submit.mutate()}
          />
        </Field>
        {requests && requests.length > 0 && (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{r.projectName}</span>
                  <span className="text-xs text-gray-500">等待 Leader 同意</span>
                </span>
                <Button size="xs" disabled={cancel.isPending} onClick={() => cancel.mutate(r)}>
                  取消申請
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button variant="primary" className="w-full" disabled={!code.trim()} loading={submit.isPending} onClick={() => submit.mutate()}>
        送出加入申請
      </Button>
    </div>
  );
}
