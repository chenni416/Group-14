import { ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardHeader, IconButton } from '@/components/ui';
import { CHART_COLORS } from '@/lib/constants';
import type { BoardState, Task } from '@/types';
import { ChartTooltipCard, LegendItem } from './ChartTooltip';

const SEGMENTS: Array<{ state: BoardState; label: string; color: string }> = [
  { state: 'IN_PROGRESS', label: 'In Progress', color: CHART_COLORS.orange },
  { state: 'IN_REVIEW', label: 'In Review', color: CHART_COLORS.violet },
  { state: 'DONE', label: 'Done', color: CHART_COLORS.sky },
  { state: 'TODO', label: 'To Do', color: CHART_COLORS.track },
];

export function StatusDonut({ tasks }: { tasks: Pick<Task, 'state'>[] }) {
  const navigate = useNavigate();
  const data = SEGMENTS.map((s) => ({ ...s, value: tasks.filter((t) => t.state === s.state).length }));
  const total = tasks.length;

  return (
    <Card>
      <CardHeader
        title="任務狀態"
        description="本 Sprint 各狀態的任務數"
        action={
          <IconButton aria-label="開啟看板" onClick={() => navigate('/board')}>
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        }
      />
      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.filter((d) => d.value > 0)}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="#FFFFFF"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data
                .filter((d) => d.value > 0)
                .map((d) => (
                  <Cell key={d.state} fill={d.color} />
                ))}
            </Pie>
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !p) return null;
                return <ChartTooltipCard rows={[{ color: p.color, label: p.label, value: `${p.value} 項` }]} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-gray-900">{total}</span>
          <span className="text-xs text-gray-500">tasks</span>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2">
        {data.map((d) => (
          <LegendItem key={d.state} color={d.color} label={d.label} value={d.value} />
        ))}
      </div>
    </Card>
  );
}
