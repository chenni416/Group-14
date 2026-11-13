import { Card, CardHeader } from '@/components/ui';
import type { Task } from '@/types';

export function AcceptanceCriteria({ task }: { task: Task }) {
  return (
    <Card className="p-5">
      <CardHeader title="驗收條件" description="Acceptance Criteria" className="mb-3" />
      <ol className="space-y-2">
        {task.acceptanceCriteria.map((ac, i) => (
          <li key={i} className="flex gap-3 text-sm text-gray-700">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] tabular-nums text-gray-600">
              {i + 1}
            </span>
            {ac}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-gray-500">{task.description}</p>
    </Card>
  );
}
