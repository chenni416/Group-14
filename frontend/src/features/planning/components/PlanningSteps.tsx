import { Check } from 'lucide-react';
import { Fragment } from 'react';
import { cn } from '@/lib/cn';
import { PLANNING_STEPS } from '@/lib/planning';
import type { PlanningStep } from '@/types';

/** 頂部四步驟：① 輸入 → ② AI 拆解 → ③ 審核調整 → ④ 核准發送 */
export function PlanningSteps({ current }: { current: PlanningStep }) {
  return (
    <ol className="mb-6 flex items-center overflow-x-auto rounded-full border border-gray-100 bg-white p-1.5 shadow-card" aria-label="規劃步驟">
      {PLANNING_STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <Fragment key={label}>
            {i > 0 && <span className="h-px w-4 shrink-0 bg-gray-200 sm:w-6" aria-hidden />}
            <li
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex min-w-fit flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm',
                active ? 'bg-neutral-900 font-medium text-white' : done ? 'text-gray-900' : 'text-gray-400',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  active ? 'bg-white/20 text-white' : done ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-500',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : n}
              </span>
              {label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
