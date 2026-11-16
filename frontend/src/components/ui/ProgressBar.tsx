import { cn } from '@/lib/cn';

export type BarTone = 'dark' | 'orange' | 'sky' | 'violet' | 'red' | 'green';

const fills: Record<BarTone, string> = {
  dark: 'bg-neutral-900',
  orange: 'bg-accent-orange',
  sky: 'bg-accent-sky',
  violet: 'bg-accent-violet',
  red: 'bg-red-500',
  green: 'bg-emerald-500',
};

export interface BarSegment {
  value: number;
  tone: BarTone;
  label?: string;
}

interface Props {
  /** 單一值或多段堆疊 */
  value?: number;
  segments?: BarSegment[];
  max: number;
  tone?: BarTone;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

export function ProgressBar({ value = 0, segments, max, tone = 'dark', size = 'md', className, label }: Props) {
  const parts = segments ?? [{ value, tone }];
  const safeMax = max > 0 ? max : 1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={parts.reduce((a, p) => a + p.value, 0)}
      className={cn('flex w-full gap-0.5 overflow-hidden rounded-full bg-gray-100', heights[size], className)}
    >
      {parts.map((p, i) =>
        p.value > 0 ? (
          <div
            key={i}
            title={p.label}
            className={cn('h-full rounded-full', fills[p.tone])}
            style={{ width: `${Math.min(100, (p.value / safeMax) * 100)}%` }}
          />
        ) : null,
      )}
    </div>
  );
}
