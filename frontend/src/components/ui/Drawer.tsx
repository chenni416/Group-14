import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** 標題上方的小字（例如任務編號、狀態） */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** 固定在底部的操作列 */
  footer?: ReactNode;
  className?: string;
}

/** 右側滑出的詳情面板 */
export function Drawer({ open, onClose, title, eyebrow, children, footer, className }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('flex h-full w-full max-w-xl flex-col bg-white shadow-pop sm:rounded-l-3xl', className)}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">{eyebrow}</div>}
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
          </div>
          <IconButton aria-label="關閉" size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </header>
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
