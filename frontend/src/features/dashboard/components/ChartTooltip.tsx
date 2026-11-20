interface Row {
  color: string;
  label: string;
  value: string;
}

export function ChartTooltipCard({ title, rows }: { title?: string; rows: Row[] }) {
  return (
    <div className="min-w-[150px] rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-xs shadow-pop">
      {title && <div className="mb-1.5 font-medium text-gray-900">{title}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="font-medium tabular-nums text-gray-900">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendItem({ color, label, value }: { color: string; label: string; value?: number | string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-gray-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
      {value != null && <span className="font-medium tabular-nums text-gray-900">{value}</span>}
    </span>
  );
}
