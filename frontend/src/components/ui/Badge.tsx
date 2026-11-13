import type { HTMLAttributes } from 'react';
import { TASK_STATES, type Tone } from '@/lib/constants';
import { cn } from '@/lib/cn';
import type { TaskState } from '@/types';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  orange: 'bg-orange-50 text-orange-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
  red: 'bg-red-50 text-red-700',
  dark: 'bg-neutral-900 text-white',
};

const dots: Record<Tone, string> = {
  neutral: 'bg-gray-400',
  orange: 'bg-accent-orange',
  sky: 'bg-accent-sky',
  violet: 'bg-accent-violet',
  red: 'bg-red-500',
  dark: 'bg-white',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

export function StatusBadge({ state, className }: { state: TaskState; className?: string }) {
  const s = TASK_STATES[state];
  return (
    <Badge tone={s.tone} dot className={className}>
      {s.label}
    </Badge>
  );
}

export function Tag({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 bg-white px-2.5 text-xs text-gray-600',
        className,
      )}
      {...rest}
    />
  );
}
