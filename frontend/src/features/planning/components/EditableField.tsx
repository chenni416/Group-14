import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** 藍色欄位＝Leader 可以手動修改 */
export function EditableField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-blue-200 bg-blue-50/70 p-2.5', className)}>
      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-blue-700">
        <Pencil className="h-3 w-3" strokeWidth={2.2} aria-hidden />
        {label}
      </div>
      {children}
    </div>
  );
}

export function EditableLegend() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700">
      <Pencil className="h-3 w-3" strokeWidth={2.2} aria-hidden />
      藍色欄位＝Leader 可修改
    </span>
  );
}
