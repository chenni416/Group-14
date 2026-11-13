import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface Stat {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="p-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {s.accent && <span className="h-2 w-2 rounded-full" style={{ background: s.accent }} aria-hidden />}
            {s.label}
          </div>
          <div className={cn('mt-3 text-3xl font-semibold tabular-nums tracking-tight text-gray-900')}>{s.value}</div>
          {s.hint && <div className="mt-1 text-xs text-gray-500">{s.hint}</div>}
        </Card>
      ))}
    </div>
  );
}
