import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { PlanningStage } from '@/types';
import { stageIndex, usePlanningStore } from '../store';

const STEPS: Array<{ stage: PlanningStage; marker: string; label: string }> = [
  { stage: 'setup', marker: '0', label: '開啟 Sprint 與設定' },
  { stage: 'stories', marker: 'A', label: 'Story 分析確認' },
  { stage: 'tasks', marker: 'B', label: 'Task 拆解與派工' },
  { stage: 'review', marker: 'C', label: '派工總覽與發送' },
];

/** 規劃流程步驟條：可切換到已到達的階段檢視 */
export function PlanningStepper() {
  const { stage, reached, draft, requestStage } = usePlanningStore();
  const current = stageIndex(stage);

  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="規劃流程">
      {STEPS.map((s, i) => {
        const active = s.stage === stage;
        const done = i < current;
        const enabled = i === 0 || (!!draft && i <= stageIndex(reached));
        return (
          <li key={s.stage} className="flex items-center gap-2">
            {i > 0 && <span className={cn('h-px w-6', i <= stageIndex(reached) && draft ? 'bg-gray-900' : 'bg-gray-200')} aria-hidden />}
            <button
              type="button"
              disabled={!enabled}
              aria-current={active ? 'step' : undefined}
              title={s.stage === 'setup' && !active ? '返回修改 Sprint 設定' : undefined}
              onClick={() => requestStage(s.stage)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-medium transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
                active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-600 enabled:hover:bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  active ? 'bg-white text-gray-900' : done ? 'bg-neutral-900 text-white' : 'bg-gray-100',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : s.marker}
              </span>
              {s.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
