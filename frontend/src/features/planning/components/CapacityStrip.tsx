import { Avatar, ProgressBar } from '@/components/ui';
import type { Member } from '@/types';

export function CapacityStrip({ members, load }: { members: Member[]; load: Record<string, number> }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {members.map((m) => {
        const v = load[m.id] ?? 0;
        const over = v > m.capacity;
        return (
          <div key={m.id} className="rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center gap-2">
              <Avatar member={m} size="xs" />
              <span className="truncate text-xs text-gray-700">{m.name}</span>
            </div>
            <div className="mb-1.5 mt-2 flex items-baseline justify-between">
              <span className="text-[11px] text-gray-500">SP</span>
              <span className={over ? 'text-sm font-semibold tabular-nums text-red-600' : 'text-sm font-semibold tabular-nums'}>
                {v}/{m.capacity}
              </span>
            </div>
            <ProgressBar value={v} max={m.capacity} tone={over ? 'red' : 'dark'} size="xs" label={`${m.name} 規劃負載`} />
          </div>
        );
      })}
    </div>
  );
}
