import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, IconButton, ProgressBar, type BarTone } from '@/components/ui';
import { sum } from '@/lib/format';
import type { Task } from '@/types';

type ReviewTask = Pick<Task, 'state' | 'policy' | 'reviewerId' | 'storyPoints'>;

export function ReviewQueue({ tasks }: { tasks: ReviewTask[] }) {
  const navigate = useNavigate();
  const inReview = tasks.filter((t) => t.state === 'IN_REVIEW');
  const rows: Array<[string, ReviewTask[], BarTone]> = [
    ['等待 Leader 專審', inReview.filter((t) => t.policy.mode === 'leader'), 'orange'],
    ['開放認領中', inReview.filter((t) => t.policy.mode === 'pool' && !t.reviewerId), 'sky'],
    ['審查進行中', inReview.filter((t) => (t.policy.mode === 'pool' && t.reviewerId) || t.policy.mode === 'target'), 'violet'],
  ];

  return (
    <Card>
      <CardHeader
        title="Review 佇列"
        description={`${inReview.length} 項任務正在審查`}
        action={
          <IconButton aria-label="開啟看板" onClick={() => navigate('/board')}>
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        }
      />
      <div className="space-y-5">
        {rows.map(([label, list, tone]) => (
          <div key={label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-700">{label}</span>
              <span className="tabular-nums text-gray-500">
                <span className="font-semibold text-gray-900">{list.length}</span> 項 · {sum(list.map((t) => t.storyPoints))} SP
              </span>
            </div>
            <ProgressBar value={list.length} max={inReview.length} tone={tone} size="lg" label={label} />
          </div>
        ))}
      </div>
    </Card>
  );
}
