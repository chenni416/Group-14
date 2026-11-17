import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, PageHeader, SegmentedControl } from '@/components/ui';
import { useDependencies, useMemberMap, useTasks } from '@/hooks/queries';
import { useStartSprint } from '@/features/board/hooks/useStartSprint';
import type { Member, Sprint, Task } from '@/types';
import { AssignmentSwimlanes } from './AssignmentSwimlanes';
import { DependencyPanel } from './DependencyPanel';
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
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<'lanes' | 'deps'>('lanes');
  const start = useStartSprint();
  const { data: dependencies = [] } = useDependencies(sprint.id);
  const { data: allTasks = [] } = useTasks();
  const memberMap = useMemberMap();
  const taskMap = useMemo(() => new Map<string, Task>(allTasks.map((t) => [t.id, t])), [allTasks]);
  const openTask = tasks.find((t) => t.id === openId) ?? null;

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
            <Button onClick={() => navigate(`/sprints/${sprint.id}/brief`)}>Sprint 總覽</Button>
            <Button
              variant="primary"
              disabled={!ready}
              loading={start.isPending}
              title={ready ? undefined : '所有任務都被成員接受後才能啟動'}
              onClick={() => start.mutate(sprint.id)}
            >
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Start {sprint.name}
            </Button>
          </>
        }
      />
      <p className="mb-5 text-sm text-gray-500">
        追蹤成員確認狀態。點擊任務卡可查看完整內容；協商退回的任務可直接編輯並重新發送通知。
      </p>

      <SegmentedControl<'lanes' | 'deps'>
        size="sm"
        aria-label="檢視"
        className="mb-5"
        value={view}
        onChange={setView}
        options={[
          { value: 'lanes', label: '派工追蹤' },
          { value: 'deps', label: `依賴與平行（${dependencies.length}）` },
        ]}
      />
      {view === 'lanes' ? (
        <AssignmentSwimlanes tasks={tasks} members={members} onOpen={setOpenId} />
      ) : (
        <DependencyPanel tasks={tasks} dependencies={dependencies} taskMap={taskMap} memberMap={memberMap} isLead />
      )}

      <PlannedTaskDrawer task={openTask} sprintTasks={tasks} members={members} onClose={() => setOpenId(null)} />
    </>
  );
}
