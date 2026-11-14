import { Button } from '@/components/ui';
import type { Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';

/** 本次延後的任務：已記錄到延續事項，下次建立 Sprint 時自動帶入 */
export function DeferredList({ tasks, isLead }: { tasks: Task[]; isLead: boolean }) {
  const { restoreTask } = usePlanningMutations();
  if (!tasks.length) return null;
  return (
    <section className="mt-6 rounded-3xl bg-gray-50 p-4" aria-label="本次延後">
      <h3 className="mb-2 text-sm font-semibold">
        本次延後（{tasks.length}）<span className="ml-1 text-xs font-normal text-gray-500">已記錄到延續事項，下次會議自動帶入</span>
      </h3>
      <ul className="space-y-1.5">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm">
            <span className="font-mono text-xs text-gray-500">{t.id}</span>
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            {isLead && (
              <Button size="xs" onClick={() => restoreTask.mutate(t.id)}>
                恢復
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
