import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardHeader, Skeleton } from '@/components/ui';
import { CHART_COLORS } from '@/lib/constants';
import type { BurndownPoint } from '@/types';
import { useBurndown } from '../hooks/useBurndown';
import { ChartTooltipCard, LegendItem } from './ChartTooltip';

/** points 提供時直接使用（示意專案的假資料），否則依 sprintId 取得 */
export function BurndownChart({ sprintId, points }: { sprintId: number | undefined; points?: BurndownPoint[] }) {
  const query = useBurndown(points ? undefined : sprintId);
  const data = points ?? query.data;
  const isLoading = !points && query.isLoading;

  return (
    <Card>
      <CardHeader
        title="Burndown"
        description="剩餘 Story Points"
        action={
          <div className="flex gap-4">
            <LegendItem color={CHART_COLORS.reference} label="理想" />
            <LegendItem color={CHART_COLORS.orange} label="實際" />
          </div>
        }
      />
      {isLoading || !data ? (
        <Skeleton className="h-56" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: CHART_COLORS.reference, strokeWidth: 1 }}
                content={({ active, payload, label }) => {
                  const p = payload?.[0]?.payload as BurndownPoint | undefined;
                  if (!active || !p) return null;
                  return (
                    <ChartTooltipCard
                      title={String(label)}
                      rows={[
                        { color: CHART_COLORS.reference, label: '理想剩餘', value: `${p.ideal} SP` },
                        { color: CHART_COLORS.orange, label: '實際剩餘', value: p.actual != null ? `${p.actual} SP` : '—' },
                      ]}
                    />
                  );
                }}
              />
              <Line
                type="linear"
                dataKey="ideal"
                stroke={CHART_COLORS.reference}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.reference, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="actual"
                stroke={CHART_COLORS.orange}
                strokeWidth={2}
                fill={CHART_COLORS.orange}
                fillOpacity={0.1}
                connectNulls={false}
                dot={false}
                activeDot={{ r: 5, fill: CHART_COLORS.orange, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
