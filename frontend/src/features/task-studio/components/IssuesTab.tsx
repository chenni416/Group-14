import { AlertTriangle, Lightbulb } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { ProposalDialog, ReportIssueDialog } from '@/components/domain/CollabDialogs';
import { IssueCard } from '@/components/domain/IssueCard';
import { ProposalCard } from '@/components/domain/ProposalCard';
import { useIssues, useProposals } from '@/hooks/useCollab';
import { useDisclosure } from '@/hooks/useDisclosure';
import { isOpenIssue } from '@/lib/collab';
import type { Member, Task } from '@/types';

interface Props {
  task: Task;
  me: Member;
  members: Member[];
  memberMap: Map<string, Member>;
}

/** G4：這項任務的問題回報與提案討論 */
export function IssuesTab({ task, me, members, memberMap }: Props) {
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const report = useDisclosure();
  const propose = useDisclosure();
  const mine = issues.filter((i) => i.taskId === task.id);
  const mineProposals = proposals.filter((p) => p.taskId === task.id);
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

      <Card className="p-5">
        <CardHeader
          title="提案與討論"
          description="任何人都可以提案；Leader 或 PO 決策，結果與理由會保留"
          className="mb-3"
          action={
            <Button size="sm" onClick={propose.open}>
              <Lightbulb className="h-3.5 w-3.5" strokeWidth={1.75} />
              從此任務提案
            </Button>
          }
        />
        <div className="space-y-3">
          {mineProposals.length ? (
            mineProposals.map((p) => <ProposalCard key={p.id} proposal={p} task={task} memberMap={memberMap} me={me} />)
          ) : (
            <EmptyState icon={Lightbulb} title="這項任務沒有相關提案" />
          )}
        </div>
      </Card>

      <ReportIssueDialog open={report.isOpen} onClose={report.close} taskId={task.id} />
      <ProposalDialog open={propose.isOpen} onClose={propose.close} taskId={task.id} />
    </div>
  );
}
