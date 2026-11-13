import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/** 膠囊狀按鈕群組：Active 黑底白字，Inactive 白底細灰框 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ...rest
}: Props<T>) {
  return (
    <div role="radiogroup" className={cn('flex flex-wrap gap-2', className)} {...rest}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-full border font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20',
              size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
              active
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
