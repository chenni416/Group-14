import { useNavigate } from 'react-router-dom';
import { Button, Callout, Modal } from '@/components/ui';
import { useEndSprint, useIssues, useProposals } from '@/hooks/useCollab';
import { isOpenIssue } from '@/lib/collab';
import { sum } from '@/lib/format';
import { isUnfinished } from '@/lib/planning';
import type { Sprint, Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  sprint: Sprint;
  tasks: Task[];
}

/** G7：結束 Sprint 前先看結果、未完成任務與未解決的問題與提案，結束後進入 Retrospective */
export function EndSprintDialog({ open, onClose, sprint, tasks }: Props) {
  const navigate = useNavigate();
  const end = useEndSprint();
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const list = tasks.filter((t) => t.sprintId === sprint.id && t.state !== 'DEFERRED');
  const total = sum(list.map((t) => t.storyPoints));
  const done = sum(list.filter((t) => t.state === 'DONE').map((t) => t.storyPoints));
  const unfinished = list.filter(isUnfinished).length;
  const openIssues = issues.filter((i) => i.sprintId === sprint.id && isOpenIssue(i)).length;
  const openProposals = proposals.filter((p) => p.sprintId === sprint.id && p.status === 'open').length;

  return (
    <Modal open={open} onClose={onClose} title={`結束 ${sprint.name}`} description="結束後會進入 Retrospective，回顧協作上的困難並訂出改善行動。">
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <dt className="text-xs text-gray-500">完成度</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {done}/{total} SP
            </dd>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <dt className="text-xs text-gray-500">未完成任務</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{unfinished} 項</dd>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <dt className="text-xs text-gray-500">未解決問題</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{openIssues} 個</dd>
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3">
            <dt className="text-xs text-gray-500">待決策提案</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{openProposals} 個</dd>
          </div>
        </dl>
        <Callout>未完成的任務，會在下次啟動 Sprint 時由 Leader 選擇帶入或延後；未解決的問題與提案會出現在下一次規劃前的統整。</Callout>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            loading={end.isPending}
            onClick={() =>
              end.mutate(sprint.id, {
                onSuccess: () => {
                  onClose();
                  navigate(`/sprints/${sprint.id}/retro`);
                },
              })
            }
          >
            結束並前往回顧
          </Button>
        </div>
      </div>
    </Modal>
  );
}
