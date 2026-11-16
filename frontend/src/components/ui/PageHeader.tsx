import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  /** 右側內容與標題的垂直對齊；預設對齊標題底部 */
  align?: 'end' | 'center';
  className?: string;
}

export function PageHeader({ eyebrow, title, actions, align = 'end', className }: Props) {
  return (
    <div className={cn('mb-8 flex shrink-0 flex-wrap justify-between gap-4', align === 'center' ? 'items-center' : 'items-end', className)}>
      <div className="min-w-0">
        <p className="mb-1 text-sm text-gray-500">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
