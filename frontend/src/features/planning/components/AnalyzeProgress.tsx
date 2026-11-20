import { Check, LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/** AI 拆解進行中的步驟顯示 */
export function AnalyzeProgress({ docCount }: { docCount: number }) {
  const steps = [
    `讀取專案知識庫（${docCount} 份文件）`,
    '擷取會議需求與 Sprint Goal',
    '切分 User Story 與範疇輪廓',
    '估算各 Story 的預估點數',
    '對照團隊可用容量',
  ];
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => Math.min(steps.length - 1, c + 1)), 420);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-5" aria-live="polite">
      <div className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
        AI 正在分析
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s} className={cn('flex items-center gap-3 text-sm', i > current ? 'text-gray-400' : 'text-gray-900')}>
            {i < current ? (
              <Check className="h-4 w-4 text-violet-600" strokeWidth={2.2} />
            ) : i === current ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-violet-600" strokeWidth={2} />
            ) : (
              <span className="h-4 w-4 rounded-full border border-gray-300" />
            )}
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
