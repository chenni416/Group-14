import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, CardHeader, Select } from '@/components/ui';
import { useJoinCode } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';

const EXPIRY = [
  { label: '7 天後過期', days: 7 },
  { label: '30 天後過期', days: 30 },
  { label: '不會過期', days: null },
] as const;

/** Leader 的專案邀請碼：分享給成員，成員輸入後送出申請，Leader 同意才加入 */
export function JoinCodeCard() {
  const { data: code } = useJoinCode();
  const copy = useCopyToClipboard();
  const [expiry, setExpiry] = useState(0);

  const create = useApiMutation({
    mutationFn: () => api.joinCodes.create({ expiresInDays: EXPIRY[expiry]?.days ?? 7 }),
    invalidate: [['join-codes']],
    onSuccess: (c) => toast(`已產生邀請碼 ${c.code}`),
  });
  const revoke = useApiMutation({
    mutationFn: () => api.joinCodes.revoke(),
    invalidate: [['join-codes']],
    onSuccess: () => toast('已停用邀請碼'),
  });

  const expiryControl = (
    <Select aria-label="有效期限" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className="w-36">
      {EXPIRY.map((o, i) => (
        <option key={o.label} value={i}>
          {o.label}
        </option>
      ))}
    </Select>
  );

  return (
    <Card>
      <CardHeader title="專案邀請碼" description="分享給成員，對方在「加入專案」頁輸入後送出申請，你同意才會加入" />
      {code ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <span>
              <span className="block font-mono text-xl font-semibold tracking-wider text-gray-900">{code.code}</span>
              <span className="text-xs text-gray-500">
                加入後為 {code.role}・
                {code.expiresAt ? `${new Date(code.expiresAt).toLocaleDateString('zh-TW')} 過期` : '不會過期'}
              </span>
            </span>
            <Button size="xs" onClick={() => copy(code.code, `已複製 ${code.code}`)}>
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              複製
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {expiryControl}
            <Button size="sm" loading={create.isPending} onClick={() => create.mutate()}>
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              產生新邀請碼
            </Button>
            <Button size="sm" loading={revoke.isPending} onClick={() => revoke.mutate()}>
              停用
            </Button>
          </div>
          <p className="text-xs text-gray-500">產生新邀請碼後，舊的邀請碼就不能再使用。</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {expiryControl}
          <Button variant="primary" size="sm" loading={create.isPending} onClick={() => create.mutate()}>
            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} />
            產生邀請碼
          </Button>
        </div>
      )}
    </Card>
  );
}
