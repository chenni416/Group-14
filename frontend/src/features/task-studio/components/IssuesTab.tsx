import { AlertTriangle } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { ReportIssueDialog } from '@/components/domain/CollabDialogs';
import { IssueCard } from '@/components/domain/IssueCard';
import { useIssues } from '@/hooks/useCollab';
import { useDisclosure } from '@/hooks/useDisclosure';
import { isOpenIssue } from '@/lib/collab';
import type { Member, Task } from '@/types';
import { TaskComments } from './TaskComments';

interface Props {
  task: Task;
  me: Member;
  members: Member[];
  memberMap: Map<string, Member>;
}

/** G4：這項任務的問題回報與留言區 */
export function IssuesTab({ task, me, members, memberMap }: Props) {
  const { data: issues = [] } = useIssues();
  const report = useDisclosure();
  const mine = issues.filter((i) => i.taskId === task.id);
  const open = mine.filter(isOpenIssue).length;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <CardHeader
          title="問題回報"
          description={open ? `${open} 個問題尚未結案，任務在看板上會顯示「被阻礙」` : '遇到技術困難、前置依賴或時程問題時回報，系統會推薦處理人並通知對方'}
          className="mb-3"
          action={
            <Button size="sm" variant="primary" onClick={report.open}>
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
              回報問題
            </Button>
          }
        />
        <div className="space-y-3">
          {mine.length ? (
            mine.map((i) => <IssueCard key={i.id} issue={i} task={task} members={members} memberMap={memberMap} me={me} />)
          ) : (
            <EmptyState icon={AlertTriangle} title="這項任務沒有回報的問題" />
          )}
        </div>
      </Card>

      <TaskComments task={task} me={me} members={members} memberMap={memberMap} />

      <ReportIssueDialog open={report.isOpen} onClose={report.close} taskId={task.id} />
    </div>
  );
}
