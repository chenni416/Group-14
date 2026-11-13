import { Check, Minus } from 'lucide-react';

type Cell = boolean | string;
const ROWS: Array<[string, Cell, Cell, Cell]> = [
  ['AI 拆解會議紀錄', true, true, false],
  ['調整與核准指派', true, true, false],
  ['啟動 Sprint', true, false, false],
  ['設定專案 Review 預設策略', true, true, false],
  ['覆蓋單一任務 Review 策略', true, true, '負責人'],
  ['Leader 專審', true, true, false],
  ['領取 Review（Claim）', true, true, true],
  ['接受／協商任務', true, true, true],
];

const CellView = ({ v }: { v: Cell }) =>
  v === true ? (
    <Check className="mx-auto h-4 w-4 text-gray-900" strokeWidth={2} aria-label="可以" />
  ) : v === false ? (
    <Minus className="mx-auto h-4 w-4 text-gray-300" strokeWidth={2} aria-label="不可以" />
  ) : (
    <span className="text-xs text-gray-500">{v}</span>
  );

export function PermissionMatrix() {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-500">
            <th className="px-2 pb-3 text-left font-medium">動作</th>
            <th className="px-2 pb-3 font-medium">Leader</th>
            <th className="px-2 pb-3 font-medium">PO</th>
            <th className="px-2 pb-3 font-medium">Member</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ROWS.map(([label, ...cells]) => (
            <tr key={label}>
              <td className="px-2 py-2.5 text-gray-700">{label}</td>
              {cells.map((c, i) => (
                <td key={i} className="px-2 py-2.5 text-center">
                  <CellView v={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
