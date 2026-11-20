import { Clock, Undo2, X } from 'lucide-react';
import { Button, Label, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { wouldCycle, type DepRef } from '@/lib/planning';
import type { DraftDependency } from '@/types';
import { useDraftDeps } from '../hooks/useDraftDeps';
import { usePlanningStore, type DepKind } from '../store';
import { ADVICE_STYLE } from '../adviceStyle';

interface Props {
  kind: DepKind;
  item: { id: string; code: string; dependsOn: DraftDependency[]; deferred?: boolean };
  className?: string;
}

function RefRow({ r, onRemove }: { r: DepRef; onRemove?: () => void }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
      <div className="min-w-0 flex-1 text-sm">
        <span className="font-mono text-xs text-gray-500">{r.code}</span> <span className="text-gray-900">{r.title}</span>
        {r.carry && <span className="text-xs text-gray-500">（上輪帶入）</span>}
        {r.deferred && <span className="ml-1 text-xs font-medium text-red-600">已延後</span>}
        <p className="mt-0.5 text-xs text-gray-500">{r.reason}</p>
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label={`移除相依 ${r.code}`}
          onClick={onRemove}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-200 hover:text-gray-900"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
    </li>
  );
}

/**
 * 相依與排序：建議（本輪完成的順位、延至下輪、建議延後）、需先完成的前置項目（可新增或移除），
 * 以及完成後才能接續的後續項目。
 */
export function DependencyEditor({ kind, item, className }: Props) {
  const { draft, carryTasks, planOf } = useDraftDeps();
  const { addDependency, removeDependency, requestDefer, requestRestore } = usePlanningStore();
  if (!draft) return null;

  const { advice, waitFor, unlocks } = planOf(item.id);
  const nodes = kind === 'story' ? draft.stories : draft.tasks;
  const taken = new Set(waitFor.map((d) => d.id));
  const noun = kind === 'story' ? ' Story' : '任務';
  const candidates =
    kind === 'story'
      ? draft.stories
          .filter((s) => s.id !== item.id && !taken.has(s.id) && !wouldCycle(nodes, item.id, s.id))
          .map((s) => ({ id: s.id, label: `${s.code} ${s.title}${s.deferred ? '（已延後）' : ''}` }))
      : [
          ...draft.tasks
            .filter((t) => t.id !== item.id && !taken.has(t.id) && !wouldCycle(nodes, item.id, t.id))
            .map((t) => ({ id: t.id, label: `${t.code} ${t.title}${t.deferred ? '（已延後）' : ''}` })),
          ...carryTasks.filter((t) => t.carry === true && !taken.has(t.id)).map((t) => ({ id: t.id, label: `${t.id} ${t.title}（上輪帶入）` })),
        ];

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label className="mb-0">相依與排序</Label>
          {item.deferred ? (
            <Button size="xs" aria-label={`取消延後 ${item.code}`} onClick={() => requestRestore(kind, item.id)}>
              <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              取消延後
            </Button>
          ) : (
            <Button
              size="xs"
              aria-label={`延後 ${item.code}`}
              title={kind === 'story' ? 'Story 與底下所有 Task 延後到之後的 Sprint' : '延後到之後的 Sprint，本輪不處理'}
              onClick={() => requestDefer(kind, item.id)}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
              延後到下輪
            </Button>
          )}
        </div>
        {advice ? (
          <p className={cn('rounded-xl border px-3 py-2 text-xs leading-relaxed', ADVICE_STYLE[advice.kind])}>
            <span className="mr-1.5 font-semibold">{advice.label}</span>
            {advice.text}
          </p>
        ) : (
          <p className="text-xs text-gray-500">沒有相依，可以和其他{noun}平行進行。</p>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-gray-700">需先完成（等它們完成後才能接續）</p>
        {waitFor.length > 0 ? (
          <ul className="space-y-1.5">
            {waitFor.map((r) => (
              <RefRow key={r.id} r={r} onRemove={() => removeDependency(kind, item.id, r.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">不需等待其他{noun}，可以直接開始。</p>
        )}
        {candidates.length > 0 && (
          <Select
            aria-label={`${item.code} 新增需先完成的項目`}
            className="mt-2"
            value=""
            onChange={(e) => e.target.value && addDependency(kind, item.id, { id: e.target.value, reason: '由 Leader 手動標註' })}
          >
            <option value="">新增需先完成的{noun}…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      {unlocks.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-700">完成後才能接續（這些{noun}在等它）</p>
          <ul className="space-y-1.5">
            {unlocks.map((r) => (
              <RefRow key={r.id} r={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
