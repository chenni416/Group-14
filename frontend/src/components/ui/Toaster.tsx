import { useEffect } from 'react';
import { useToastStore } from '@/stores/toast.store';

export function Toaster() {
  const { message, key, dismiss } = useToastStore();

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(dismiss, 2800);
    return () => clearTimeout(t);
  }, [message, key, dismiss]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div className="pointer-events-auto max-w-md rounded-full bg-neutral-900 px-5 py-3 text-sm text-white shadow-pop">{message}</div>
    </div>
  );
}
