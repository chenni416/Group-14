import { ArrowDown } from 'lucide-react';
import { Fragment } from 'react';

const NODES: Array<[string, string]> = [
  ['會議紀錄上傳', ''],
  ['AI 拆解任務', 'AI_DRAFT'],
  ['Leader 審核 / 調整', 'PENDING_MEMBER'],
  ['成員接受認領', 'ASSIGNED'],
  ['Sprint 啟動', 'To Do'],
  ['取得 Agent Prompt 開發', 'In Progress'],
  ['PR 發布，依策略路由', 'In Review'],
  ['通過審查', 'Done'],
];

/** 任務狀態機流程 */
export function StateFlow() {
  return (
    <ol className="space-y-1">
      {NODES.map(([label, code], i) => (
        <Fragment key={label}>
          {i > 0 && (
            <li aria-hidden className="flex items-center gap-2 py-0.5 pl-4 text-xs text-gray-400">
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              {i === 3 && <span className="text-red-600">成員拒絕時退回 Leader 重新指派</span>}
            </li>
          )}
          <li className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-2.5 text-sm">
            <span className="text-gray-900">{label}</span>
            {code && <span className="font-mono text-xs text-gray-500">{code}</span>}
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
