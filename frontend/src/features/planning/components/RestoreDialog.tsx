import { Button, Modal } from '@/components/ui';
import { useDraftDeps } from '../hooks/useDraftDeps';
import { usePlanningStore } from '../store';

/** 取消延後時，若需先完成的項目仍在延後，列出它們讓 Leader 選擇一起取消延後或移除相依 */
export function RestoreDialog() {
  const { restoreRequest: req, resolveRestore, cancelRestore } = usePlanningStore();
  const { resolve } = useDraftDeps();
  if (!req) return null;
  const prereqs = [...req.prereqStories, ...req.prereqTasks].map((id) => resolve(id)).filter((x) => x != null);
  const what = req.kind === 'story' ? `${req.code} 與底下的 Task` : req.code;

  return (
    <Modal
      open
      onClose={cancelRestore}
      title={`取消延後 ${req.code}？`}
      description={`${what} 需要以下 ${prereqs.length} 項先完成才能接續，它們目前仍是延後狀態。只取消延後 ${req.code} 的話，它在本輪會等不到前置項目，送出派工前必須處理。`}
    >
      <ul className="space-y-1.5" aria-label="仍在延後的前置項目">
        {prereqs.map((x) => (
          <li key={x.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono text-xs text-gray-500">{x.code}</span>
            <span className="min-w-0 flex-1 truncate text-gray-900">{x.title}</span>
            <span className="text-xs text-gray-500">{x.kind === 'story' ? 'Story（含 Task）· 已延後' : '已延後'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={cancelRestore}>取消</Button>
        <Button onClick={() => resolveRestore('drop')} title="改為不需等待它們，它們維持延後">
          移除相依，只取消延後 {req.code}
        </Button>
        <Button variant="primary" onClick={() => resolveRestore('with')} title="建議：前置項目一起回到本輪">
          一起取消延後 {prereqs.length + 1} 項（建議）
        </Button>
      </div>
    </Modal>
  );
}
