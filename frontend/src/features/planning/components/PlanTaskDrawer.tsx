import { ArrowDownToLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, ConfirmDialog, Drawer, Input, Tag } from '@/components/ui';
import { DOMAINS } from '@/lib/constants';
import { branchName } from '@/lib/planning';
import type { Member, TaskDraft } from '@/types';
import { usePlanningStore } from '../store';
import { TaskDraftFields } from './TaskDraftCard';

interface Props {
  task: TaskDraft | null;
  /** capacity 為本輪完整 Capacity */
  members: Member[];
  /** 各成員本輪負載（新任務 + 上輪帶入） */
  load: Record<string, number>;
  /** false 時不能取消指派（派工總覽） */
  allowUnassign?: boolean;
  onAssign: (taskId: string, memberId: string | null) => void;
  /** 提供時顯示「在工作區開啟」（Task 拆解階段） */
  onOpenInWorkspace?: (task: TaskDraft) => void;
  onClose: () => void;
}

/** Team Capacity 上的本輪任務卡：點開直接調整，修改即時寫入規劃草稿 */
export function PlanTaskDrawer({ task, members, load, allowUnassign = true, onAssign, onOpenInWorkspace, onClose }: Props) {
  const { draft, updateTask, removeTask } = usePlanningStore();
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (!task || !draft) return null;
  const story = draft.stories.find((s) => s.id === task.storyId);

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        eyebrow={
          <>
            <span className="font-mono text-gray-500">{task.code}</span>
            <Tag>{DOMAINS[task.domain].label}</Tag>
            {story && <span className="truncate text-gray-500">{story.title}</span>}
          </>
        }
        title="調整本輪任務"
        footer={
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              移除任務
            </Button>
            {onOpenInWorkspace && (
              <Button onClick={() => onOpenInWorkspace(task)}>
                <ArrowDownToLine className="h-4 w-4" strokeWidth={1.75} />
                在工作區開啟
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>
              完成
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input value={task.title} aria-label="任務標題" onChange={(e) => updateTask(task.id, { title: e.target.value })} className="font-medium" />
          <TaskDraftFields
            task={task}
            branch={branchName(draft, task)}
            members={members}
            load={load}
            allowUnassign={allowUnassign}
            onChange={(patch) => updateTask(task.id, patch)}
            onAssign={(memberId) => onAssign(task.id, memberId)}
          />
          <p className="text-xs text-gray-500">修改會直接套用到規劃草稿；送出派工前都可以再調整。</p>
        </div>
      </Drawer>
      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          removeTask(task.id);
          onClose();
        }}
        title={`移除 ${task.code}？`}
        description={`「${task.title}」會從本輪規劃中刪除，無法復原。`}
        confirmLabel="移除"
      />
    </>
  );
}
