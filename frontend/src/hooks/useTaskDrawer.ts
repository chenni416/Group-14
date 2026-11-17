import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskState } from '@/types';

export type DrawerTab = 'spec' | 'plan' | 'issues' | 'delivery' | 'prompt';

export const DRAWER_TABS: DrawerTab[] = ['spec', 'plan', 'issues', 'delivery', 'prompt'];

/** 開啟任務時預設顯示的分頁：接受前看規格，執行中看計畫，送審後看交付與驗收 */
export function defaultTab(state: TaskState): DrawerTab {
  if (state === 'TODO' || state === 'IN_PROGRESS') return 'plan';
  if (state === 'IN_REVIEW' || state === 'DONE') return 'delivery';
  return 'spec';
}

/** 任務詳情以 ?task=ID（與 ?tab=）開啟，任何頁面都能疊加顯示，連結可以直接分享 */
export function useTaskDrawer() {
  const [params, setParams] = useSearchParams();
  const taskId = params.get('task');
  const raw = params.get('tab');
  const tab = DRAWER_TABS.find((t) => t === raw) ?? null;

  const open = useCallback(
    (id: string, nextTab?: DrawerTab) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('task', id);
        if (nextTab) next.set('tab', nextTab);
        else next.delete('tab');
        return next;
      }),
    [setParams],
  );

  const setTab = useCallback(
    (nextTab: DrawerTab) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', nextTab);
        return next;
      }),
    [setParams],
  );

  const close = useCallback(
    () =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('task');
        next.delete('tab');
        return next;
      }),
    [setParams],
  );

  return { taskId, tab, open, setTab, close };
}
