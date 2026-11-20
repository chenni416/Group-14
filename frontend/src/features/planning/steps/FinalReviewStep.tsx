import { ArrowLeft, Clock, Send, Unlink } from 'lucide-react';
import { Button, Callout, ConfirmDialog } from '@/components/ui';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { dependencyIssues, loadByMember } from '@/lib/planning';
import type { Member } from '@/types';
import { OverloadCheck } from '../components/OverloadCheck';
import { TeamCapacityBar } from '../components/TeamCapacityBar';
import { useAssignDraftTask } from '../hooks/useAssignDraftTask';
import { useDraftDeps } from '../hooks/useDraftDeps';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';

/**
 * 階段 C：最終派工總覽。
 * 只呈現完整展開的 Team Capacity（仍可拖曳微調），底部操作列確認後以精簡對話框發送通知。
 */
export function FinalReviewStep({ members }: { members: Member[] }) {
  const { draft, setStage, requestDefer, removeDependency } = usePlanningStore();
  const { carryTasks } = useDraftDeps();
  const assign = useAssignDraftTask(members);
  const { submit } = usePlanningMutations();
  const confirm = useDisclosure();
  if (!draft) return null;

  const { tasks } = draft;
  // 延後的項目留在草稿中標註，這裡只統計本輪要派工的
  const stories = draft.stories.filter((s) => !s.deferred);
  const active = tasks.filter((t) => !t.deferred);
  const load = loadByMember(members, tasks);
  const overloaded = members.filter((m) => (load[m.id] ?? 0) > m.capacity);
  const unassigned = active.filter((t) => !t.assigneeId).length;
  const notified = new Set(active.map((t) => t.assigneeId).filter(Boolean)).size;
  const totalSp = sum(active.map((t) => t.storyPoints));
  const issues = dependencyIssues(draft, carryTasks);
  const blocking = issues.filter((i) => i.level === 'blocking');

  const status =
    blocking.length > 0
      ? { text: `${blocking.length} 項相依問題需處理`, className: 'text-red-600' }
      : unassigned > 0
        ? { text: `${unassigned} 張 Task 未指派`, className: 'text-orange-700' }
        : overloaded.length > 0
          ? { text: `${overloaded.length} 位成員超載`, className: 'text-red-600' }
          : { text: '全隊負載正常', className: 'text-gray-900' };

  return (
    <div>
      <OverloadCheck members={members} />
      {issues.length > 0 && (
        <Callout
          tone={blocking.length ? 'danger' : 'warning'}
          title={blocking.length ? '需等待的項目已延後，送出派工前需要處理' : '相依提醒'}
          className="mb-5"
        >
          <ul className="mt-1 space-y-2" aria-label="相依問題">
            {issues.map((i) => (
              <li key={`${i.itemId}-${i.depId}`} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1">{i.text}</span>
                {i.level === 'blocking' && (
                  <Button size="xs" onClick={() => requestDefer(i.kind, i.itemId)}>
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                    一起延後 {i.itemCode}
                  </Button>
                )}
                <Button size="xs" onClick={() => removeDependency(i.kind, i.itemId, i.depId)}>
                  <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  移除相依
                </Button>
              </li>
            ))}
          </ul>
        </Callout>
      )}
      <TeamCapacityBar members={members} tasks={tasks} onAssign={assign} forceExpanded hideUnassigned />

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_0_0_12px_#fff,0_32px_0_12px_#fff]">
        <p className="text-sm tabular-nums text-gray-500">
          共 {stories.length} 個 Story · {active.length} 張 Task · 總計 {totalSp} SP ·{' '}
          <span className={cn('font-medium', status.className)}>{status.text}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setStage('tasks')}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            返回修改 Task
          </Button>
          <Button
            variant="primary"
            disabled={unassigned > 0 || blocking.length > 0}
            title={blocking.length > 0 ? '依賴的項目已延後，請先處理相依問題' : unassigned > 0 ? '仍有未指派的 Task' : undefined}
            onClick={confirm.open}
          >
            <Send className="h-4 w-4" strokeWidth={1.75} />
            確認派工並發送通知
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.isOpen}
        onClose={confirm.close}
        onConfirm={() => submit.mutate(draft)}
        loading={submit.isPending}
        title="確認完成派工並寄送通知？"
        description={`確認後系統將自動寄送 Email 與系統通知給 ${notified} 位團隊成員（共 ${active.length} 張任務卡），並開放成員進入認領階段。`}
        warning={
          overloaded.length > 0
            ? `${overloaded.map((m) => m.name).join('、')} 的負載超過 Capacity，確認後仍會依目前分配發送。`
            : undefined
        }
        confirmLabel="確認發送通知"
      />
    </div>
  );
}
