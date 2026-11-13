import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="mb-1 text-sm text-gray-500">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
