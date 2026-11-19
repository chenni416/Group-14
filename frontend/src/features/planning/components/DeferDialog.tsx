import { Button, Modal } from '@/components/ui';
import { useDraftDeps } from '../hooks/useDraftDeps';
import { usePlanningStore } from '../store';

/** 延後被依賴的項目時，列出受影響的 Story／Task，讓 Leader 選擇一起延後或移除相依 */
export function DeferDialog() {
  const { deferRequest: req, resolveDefer, cancelDefer } = usePlanningStore();
  const { resolve } = useDraftDeps();
  if (!req) return null;
  const affected = [...req.affectedStories, ...req.affectedTasks].map((id) => resolve(id)).filter((x) => x != null);
  const what = req.kind === 'story' ? `${req.code} 與底下的 Task` : req.code;

  return (
    <Modal open onClose={cancelDefer} title={`延後 ${req.code}？`} description={`以下 ${affected.length} 項需要 ${what} 先完成才能接續。只延後 ${req.code} 的話，它們在本輪會等不到前置任務，送出派工前必須處理。`}>
      <ul className="space-y-1.5" aria-label="受影響的項目">
        {affected.map((x) => (
          <li key={x.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono text-xs text-gray-500">{x.code}</span>
            <span className="min-w-0 flex-1 truncate text-gray-900">{x.title}</span>
            {x.kind === 'story' && <span className="text-xs text-gray-500">Story（含 Task）</span>}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={cancelDefer}>取消</Button>
        <Button onClick={() => resolveDefer('drop')} title="它們改為不需等待，維持在本輪">
          移除相依，只延後 {req.code}
        </Button>
        <Button variant="primary" onClick={() => resolveDefer('with')} title="建議：前置與後續一起延至下輪">
          一起延後 {affected.length + 1} 項（建議）
        </Button>
      </div>
    </Modal>
  );
}
