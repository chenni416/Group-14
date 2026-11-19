import { ArrowRight, Hourglass } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ADVICE_STYLE } from '../adviceStyle';
import { useDraftDeps } from '../hooks/useDraftDeps';


interface Props {
  itemId: string;
  /** xs：Team Capacity 小卡用 */
  size?: 'sm' | 'xs';
  className?: string;
}

/**
 * 卡片上的相依提示：
 * 建議（建議延後／可能延至下輪／第 N 順位／優先完成），以及「等 S-322 完成」「完成後接續 S-331」。
 */
export function DependencyChips({ itemId, size = 'sm', className }: Props) {
  const { planOf } = useDraftDeps();
  const { advice, waitFor, unlocks } = planOf(itemId);
  const next = unlocks.filter((u) => !u.deferred);
  if (!advice && !waitFor.length && !next.length) return null;

  const chip = cn('inline-flex items-center gap-1 rounded-full border', size === 'xs' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]');
  const icon = size === 'xs' ? 'h-2.5 w-2.5' : 'h-3 w-3';
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {advice && (
        <span className={cn(chip, 'font-medium', ADVICE_STYLE[advice.kind])} title={advice.text}>
          {advice.label}
        </span>
      )}
      {waitFor.map((w) => (
        <span
          key={w.id}
          title={`${w.code} ${w.title}：${w.reason}`}
          className={cn(chip, w.deferred ? 'border-red-200 bg-white text-red-700' : 'border-gray-200 bg-white text-gray-600')}
        >
          <Hourglass className={icon} strokeWidth={1.75} />
          <span className="font-mono">等 {w.code}</span>
          {w.deferred ? '（已延後）' : ' 完成'}
        </span>
      ))}
      {next.length > 0 && (
        <span title={next.map((u) => `${u.code} ${u.title}：${u.reason}`).join('\n')} className={cn(chip, 'border-gray-200 bg-white text-gray-600')}>
          <span>完成後接續</span>
          <ArrowRight className={icon} strokeWidth={1.75} />
          <span className="font-mono">{next.length > 2 ? `${next.length} 項` : next.map((u) => u.code).join('、')}</span>
        </span>
      )}
    </span>
  );
}
