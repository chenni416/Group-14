import { Sparkles } from 'lucide-react';
import { Avatar, Button, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { capOf } from '@/lib/planning';
import type { Member, Sprint, Task } from '@/types';

interface Props {
  sprint: Sprint;
  members: Member[];
  load: Record<string, number>;
  /** 核准前檢查後，以紅框標出超量的人 */
  flagged: boolean;
  isLead: boolean;
  need: number;
  carryPoints: number;
  suggestions: Task[];
  onDeferSuggested: () => void;
  onRebalance: () => void;
  busy: boolean;
}

/** 本次 Capacity：本次任務 + 帶入任務剩餘點數 ／ 建立 Sprint 時預估的點數 */
export function CapacityStrip({ sprint, members, load, flagged, isLead, need, carryPoints, suggestions, onDeferSuggested, onRebalance, busy }: Props) {
  const cap = members.reduce((a, m) => a + capOf(sprint, m), 0);
  const overMembers = members.filter((m) => (load[m.id] ?? 0) > capOf(sprint, m));
  const first = suggestions[0];

  return (
    <section className="mb-6" aria-label="本次 Capacity">
      {isLead && need > cap && suggestions.length > 0 && (
        <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3 text-sm text-gray-700">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            AI 容量建議
          </div>
          總需求 <b>{need} SP</b>（含上個 Sprint 帶入 {carryPoints} SP）超過本次 Capacity <b>{cap} SP</b>。建議延後：
          {suggestions.map((t) => `${t.id} ${t.title}（${t.storyPoints} SP）`).join('、')}。
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="xs" variant="primary" disabled={busy} onClick={onDeferSuggested}>
              依建議延後 {suggestions.length} 項
            </Button>
            <Button size="xs" disabled={busy} onClick={onRebalance}>
              AI 重新平衡指派
            </Button>
          </div>
        </div>
      )}
      {isLead && need <= cap && overMembers.length > 0 && (
        <div className="mb-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3 text-sm text-gray-700">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            AI 容量建議
          </div>
          {overMembers.map((m) => m.name).join('、')} 超過點數上限，但團隊總容量足夠，可以先重新平衡（不會更動你調整過的任務）
          {first && `；若仍超量，建議延後 ${first.id} ${first.title}（${first.storyPoints} SP）`}。
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="xs" variant="primary" disabled={busy} onClick={onRebalance}>
              AI 重新平衡指派
            </Button>
            {first && (
              <Button size="xs" disabled={busy} onClick={onDeferSuggested}>
                延後 {first.id}
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">本次 Capacity</h3>
        <span className="text-xs text-gray-500">本次任務 + 帶入任務剩餘點數 ／ 預估點數</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {members.map((m) => {
          const v = load[m.id] ?? 0;
          const c = capOf(sprint, m);
          const over = v > c;
          return (
            <div key={m.id} className={cn('rounded-2xl border p-3', over && flagged ? 'border-red-400 bg-red-50 ring-4 ring-red-50' : 'border-gray-100')}>
              <div className="flex items-center gap-2">
                <Avatar member={m} size="xs" />
                <span className="truncate text-xs text-gray-700">{m.name}</span>
              </div>
              <div className="mb-1.5 mt-2 flex items-baseline justify-between">
                <span className="text-[11px] text-gray-500">SP</span>
                <span className={cn('text-sm font-semibold tabular-nums', over && 'text-red-600')}>
                  {v}/{c}
                </span>
              </div>
              <ProgressBar value={v} max={c} tone={over ? 'red' : 'dark'} size="xs" label={`${m.name} 規劃負載`} />
              {over && <p className="mt-1 text-[11px] font-medium text-red-600">超出 {v - c} SP</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
