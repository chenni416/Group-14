import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'warning' | 'danger' | 'ai';

const tones: Record<Tone, string> = {
  neutral: 'bg-gray-50 text-gray-600',
  warning: 'bg-orange-50 text-orange-800',
  danger: 'bg-red-50 text-red-800',
  ai: 'border border-violet-100 bg-violet-50/60 text-gray-700',
};

export function Callout({ tone = 'neutral', title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl px-4 py-3 text-sm leading-relaxed', tones[tone], className)}>
      {title && <div className={cn('mb-1 text-xs font-semibold', tone === 'ai' ? 'text-violet-700' : '')}>{title}</div>}
      {children}
    </div>
  );
}
