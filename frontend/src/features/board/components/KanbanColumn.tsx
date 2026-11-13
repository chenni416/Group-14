import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { TASK_STATES } from '@/lib/constants';
import type { BoardState } from '@/types';

const DESCRIPTIONS: Record<BoardState, string> = {
  TODO: '已確認接收，待開發',
  IN_PROGRESS: '開發中 / AI 輔助開發',
  IN_REVIEW: 'PR 已發布，待 Code Review',
  DONE: '通過驗收與測試',
};

export function KanbanColumn({ state, count, children }: { state: BoardState; count: number; children: ReactNode }) {
  return (
    <section className="flex min-w-[260px] flex-col rounded-3xl bg-gray-50 p-3" aria-label={TASK_STATES[state].label}>
      <header className="mb-3 flex items-start justify-between px-2 pt-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{TASK_STATES[state].label}</h3>
          <p className="text-xs text-gray-500">{DESCRIPTIONS[state]}</p>
        </div>
        <Badge className="bg-white tabular-nums">{count}</Badge>
      </header>
      <div className="flex flex-1 flex-col gap-3">
        {children}
        {count === 0 && <p className="px-2 py-4 text-center text-xs text-gray-400">沒有任務</p>}
      </div>
    </section>
  );
}
