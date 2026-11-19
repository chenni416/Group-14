import { Play } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, PageHeader } from '@/components/ui';
import { useStartSprint } from '@/features/board/hooks/useStartSprint';
import { useSprintContext } from '@/hooks/queries';
import { planLoad } from '@/lib/planning';
import type { Member, Sprint, Task } from '@/types';
import { AssignmentSwimlanes } from './AssignmentSwimlanes';
import { CarryTaskDrawer } from './CarryTaskDrawer';
import { PlannedTaskDrawer } from './PlannedTaskDrawer';

interface Props {
  sprint: Sprint;
  tasks: Task[];
  members: Member[];
  /** 所有任務皆已被接受，可啟動 Sprint */
  ready: boolean;
}

/** 已核准並發送派工通知後：滿版泳道追蹤看板，取代 Source Context 與規劃流程 */
export function SubmittedPlanBoard({ sprint, tasks, members, ready }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const start = useStartSprint();
  // 已發送給成員確認的上輪帶入／延後決定
  const carryTasks = useSprintContext().carryTasks.filter((t) => t.carryStatus != null);
  const openTask = tasks.find((t) => t.id === openId) ?? null;
  const openCarry = carryTasks.find((t) => t.id === openId) ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Sprint Planning Studio"
        title={`${sprint.name} 規劃`}
        align="center"
        className="mb-4"
        actions={
          <>
            <Badge tone="sky" dot>
              派工通知已發送
            </Badge>
            <Button
              variant="primary"
              disabled={!ready}
              loading={start.isPending}
              title={ready ? undefined : '所有任務與帶入／延後決定都被成員接受後才能啟動'}
              onClick={() => start.mutate(sprint.id)}
            >
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Start {sprint.name}
            </Button>
          </>
        }
      />
      <p className="mb-5 text-sm text-gray-500">
        追蹤成員確認狀態。點擊任務卡可查看完整內容；協商退回的任務可直接編輯並重新發送通知。上輪帶入與延後的決定已鎖定，成員協商退回後才能修改。
      </p>

      <AssignmentSwimlanes sprint={sprint} tasks={tasks} carryTasks={carryTasks} members={members} onOpen={setOpenId} />

      <PlannedTaskDrawer task={openTask} sprintTasks={tasks} carryTasks={carryTasks} sprint={sprint} members={members} onClose={() => setOpenId(null)} />
      <CarryTaskDrawer
        task={openCarry}
        sprint={sprint}
        members={members}
        load={planLoad(members, tasks, carryTasks)}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
