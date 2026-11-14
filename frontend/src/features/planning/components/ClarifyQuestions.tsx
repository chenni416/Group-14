import { Check, CircleHelp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ClarifyQuestion, Sprint } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

function QuestionItem({ q, index, sprintId, disabled }: { q: ClarifyQuestion; index: number; sprintId: number; disabled: boolean }) {
  const { answer } = usePlanningMutations();
  const custom = q.options.includes(q.answer) ? '' : q.answer;
  const [text, setText] = useState(custom);
  useEffect(() => setText(custom), [custom]);
  const save = (value: string) => value.trim() && value.trim() !== q.answer && answer.mutate({ id: sprintId, questionId: q.id, answer: value });

  return (
    <li className="border-t border-violet-100 py-3 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
            q.answer ? 'bg-sky-500 text-white' : 'bg-violet-100 text-violet-700',
          )}
        >
          {q.answer ? <Check className="h-3 w-3" strokeWidth={2.6} /> : index + 1}
        </span>
        <p className="text-sm font-medium text-gray-900">{q.question}</p>
      </div>
      <div className="mt-2 space-y-2 pl-7">
        <div className="flex flex-wrap gap-1.5">
          {q.options.map((o) => (
            <button
              key={o}
              type="button"
              disabled={disabled}
              aria-pressed={q.answer === o}
              onClick={() => save(o)}
              className={cn(
                'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                q.answer === o ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {o}
            </button>
          ))}
        </div>
        <Input
          aria-label={`自行回答：${q.question}`}
          className="h-9 text-xs"
          placeholder="或自行輸入回答，按 Enter 儲存"
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => save(text)}
          onKeyDown={(e) => e.key === 'Enter' && save(text)}
        />
      </div>
    </li>
  );
}

/** 待釐清問題：全部回答後才能拆解與分配任務，回答會寫進相關任務的驗收條件 */
export function ClarifyQuestions({ sprint, isLead }: { sprint: Sprint; isLead: boolean }) {
  const qs = sprint.questions ?? [];
  if (!qs.length) return null;
  const answered = qs.filter((q) => q.answer).length;
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4" aria-label="待釐清問題">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-violet-700">
          <CircleHelp className="h-4 w-4" strokeWidth={2} />
          待釐清問題
        </h3>
        <Badge tone={answered === qs.length ? 'sky' : 'violet'} dot>
          已回答 {answered}/{qs.length}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-gray-500">會議紀錄沒講清楚的地方。全部回答後才能拆解與分配任務，回答會寫進相關任務的驗收條件。</p>
      <ol>
        {qs.map((q, i) => (
          <QuestionItem key={q.id} q={q} index={i} sprintId={sprint.id} disabled={!isLead} />
        ))}
      </ol>
    </section>
  );
}
