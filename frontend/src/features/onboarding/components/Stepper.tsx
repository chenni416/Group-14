import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Stepper({
  steps,
  current,
  onChange,
  disabled = false,
  className = 'mb-8',
}: {
  steps: string[];
  current: number;
  onChange: (i: number) => void;
  /** 只顯示進度、不能點選（例如專案建立前） */
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-wrap gap-2', className)} aria-label="初始化步驟">
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={label}>
            <button
              type="button"
              aria-current={active ? 'step' : undefined}
              disabled={disabled}
              onClick={() => onChange(i)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors duration-150',
                active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-600',
                !active && !disabled && 'hover:bg-gray-50',
                disabled && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs tabular-nums',
                  active ? 'bg-white text-gray-900' : done ? 'bg-neutral-900 text-white' : 'bg-gray-100',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : i + 1}
              </span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
