import { Check, CornerDownRight, MessageCircleQuestion, Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { Button, EmptyState, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { StoryClarifyItem, StoryDraft } from '@/types';

interface Props {
  story: StoryDraft;
  onChange: (items: StoryClarifyItem[]) => void;
}

const resolved = (i: StoryClarifyItem) => (i.kind === 'question' ? !!i.answer : !!i.decision);

/**
 * AI 對 Story 的待釐清項目：提問（選擇選項或自行輸入回答）與建議（採用或不採用）。
 * 只做前端展示：回答與決定存在規劃草稿，畫面預覽會補進的驗收條件或改動，尚未實際套用。
 */
export function StoryClarifyList({ story, onChange }: Props) {
  const items = story.clarify ?? [];
  const patch = (id: string, p: Partial<StoryClarifyItem>) => onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));

  if (!items.length)
    return <EmptyState icon={Check} title="沒有待釐清的項目" description="AI 沒有針對這個 Story 的提問或建議。" className="py-8" />;

  // 未處理的排在前面
  const sorted = [...items].sort((a, b) => Number(resolved(a)) - Number(resolved(b)));
  return (
    <ul className="space-y-3" aria-label={`${story.code} 待釐清項目`}>
      {sorted.map((item) => (
        <ClarifyCard key={item.id} item={item} onPatch={(p) => patch(item.id, p)} />
      ))}
    </ul>
  );
}

function ClarifyCard({ item, onPatch }: { item: StoryClarifyItem; onPatch: (p: Partial<StoryClarifyItem>) => void }) {
  const [custom, setCustom] = useState<string | null>(null);
  const done = resolved(item);
  const question = item.kind === 'question';
  const status = question ? (done ? '已回答' : '待回答') : item.decision === 'accept' ? '已採用' : item.decision === 'reject' ? '不採用' : '待確認';
  const Icon = question ? MessageCircleQuestion : Lightbulb;

  return (
    <li className={cn('rounded-2xl border p-4', done ? 'border-gray-100 bg-white' : 'border-orange-200 bg-orange-50/30')}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          {question ? 'AI 提問' : 'AI 建議'}
        </span>
        <span className={cn('font-medium', done ? 'text-gray-500' : 'text-orange-700')}>{status}</span>
      </div>
      <p className="text-sm leading-relaxed text-gray-900">{item.text}</p>

      {question && !done && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="回答選項">
            {item.options?.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onPatch({ answer: o })}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 transition-colors duration-150 hover:border-gray-900"
              >
                {o}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(custom == null ? '' : null)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors duration-150',
                custom != null ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-900',
              )}
            >
              其他…
            </button>
          </div>
          {custom != null && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!custom.trim()) return;
                onPatch({ answer: custom.trim() });
                setCustom(null);
              }}
            >
              <Input autoFocus aria-label="自行輸入回答" placeholder="輸入你的回答" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9 text-sm" />
              <Button type="submit" size="sm" variant="primary" disabled={!custom.trim()}>
                回答
              </Button>
            </form>
          )}
        </div>
      )}

      {question && done && (
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="text-gray-700">
            <span className="text-gray-500">回答：</span>
            {item.answer}
          </p>
          <Effect>將補進驗收條件：「{item.effect.replace('{answer}', item.answer ?? '')}」</Effect>
        </div>
      )}

      {!question && !done && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="xs" variant="primary" onClick={() => onPatch({ decision: 'accept' })}>
            採用建議
          </Button>
          <Button size="xs" onClick={() => onPatch({ decision: 'reject' })}>
            不採用
          </Button>
        </div>
      )}

      {!question && done && (
        <div className="mt-3 text-sm">
          {item.decision === 'accept' ? <Effect>{item.effect}</Effect> : <p className="text-xs text-gray-500">已略過這則建議，維持目前的切分。</p>}
        </div>
      )}

      {done && (
        <div className="mt-2 flex justify-end">
          <Button size="xs" variant="ghost" onClick={() => onPatch(question ? { answer: null } : { decision: null })}>
            {question ? '修改回答' : '重新決定'}
          </Button>
        </div>
      )}
    </li>
  );
}

const Effect = ({ children }: { children: React.ReactNode }) => (
  <p className="flex gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
    <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={1.75} />
    <span>{children}</span>
  </p>
);
