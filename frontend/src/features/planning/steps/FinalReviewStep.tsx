import { ArrowLeft, Send } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { loadByMember } from '@/lib/planning';
import type { Member } from '@/types';
import { TeamCapacityBar } from '../components/TeamCapacityBar';
import { useAssignDraftTask } from '../hooks/useAssignDraftTask';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';

/**
 * 階段 C：最終派工總覽。
 * 只呈現完整展開的 Team Capacity（仍可拖曳微調），底部操作列確認後以精簡對話框發送通知。
 */
export function FinalReviewStep({ members }: { members: Member[] }) {
  const { draft, setStage } = usePlanningStore();
  const assign = useAssignDraftTask(members);
  const { submit } = usePlanningMutations();
  const confirm = useDisclosure();
  if (!draft) return null;

  const { stories, tasks } = draft;
  const load = loadByMember(members, tasks);
  const overloaded = members.filter((m) => (load[m.id] ?? 0) > m.capacity);
  const unassigned = tasks.filter((t) => !t.assigneeId).length;
  const notified = new Set(tasks.map((t) => t.assigneeId).filter(Boolean)).size;
  const totalSp = sum(tasks.map((t) => t.storyPoints));

  const status =
    unassigned > 0
      ? { text: `${unassigned} 張 Task 未指派`, className: 'text-orange-700' }
      : overloaded.length > 0
        ? { text: `${overloaded.length} 位成員超載`, className: 'text-red-600' }
        : { text: '全隊負載正常', className: 'text-gray-900' };

  return (
    <div>
      <TeamCapacityBar members={members} tasks={tasks} onAssign={assign} forceExpanded hideUnassigned />

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_0_0_12px_#fff,0_32px_0_12px_#fff]">
        <p className="text-sm tabular-nums text-gray-500">
          共 {stories.length} 個 Story · {tasks.length} 張 Task · 總計 {totalSp} SP ·{' '}
          <span className={cn('font-medium', status.className)}>{status.text}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setStage('tasks')}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            返回修改 Task
          </Button>
          <Button
            variant="primary"
            disabled={unassigned > 0}
            title={unassigned > 0 ? '仍有未指派的 Task' : undefined}
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
        description={`確認後系統將自動寄送 Email 與系統通知給 ${notified} 位團隊成員（共 ${tasks.length} 張任務卡），並開放成員進入認領階段。`}
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
