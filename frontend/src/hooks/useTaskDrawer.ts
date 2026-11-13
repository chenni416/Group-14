import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** 任務詳情以 ?task=ID 開啟，任何頁面都能疊加顯示 */
export function useTaskDrawer() {
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');

  const open = useCallback(
    (id: string) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('task', id);
        return next;
      }),
    [setParams],
  );

  const close = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('task');
        return next;
      }),
    [setParams],
  );

  return { taskId, open, close };
}
