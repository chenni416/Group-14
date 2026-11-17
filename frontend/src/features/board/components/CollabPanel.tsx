import { AlertTriangle, Lightbulb, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, EmptyState, IconButton, SegmentedControl, Select } from '@/components/ui';
import { IssueCard } from '@/components/domain/IssueCard';
import { ProposalCard } from '@/components/domain/ProposalCard';
import { ProposalDialog, ReportIssueDialog } from '@/components/domain/CollabDialogs';
import { useCurrentUser, useMemberMap, useMembers, useTasks } from '@/hooks/queries';
import { useIssues, useProposals } from '@/hooks/useCollab';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useTaskDrawer } from '@/hooks/useTaskDrawer';
import { ISSUE_STATUS, PROPOSAL_STATUS, isOpenIssue } from '@/lib/collab';
import { useUiStore } from '@/stores/ui.store';
import type { IssueStatus, ProposalStatus, Task } from '@/types';

type IssueFilter = 'open' | 'all' | IssueStatus;
type ProposalFilter = 'open' | 'all' | ProposalStatus;

/** 看板右側欄：所有問題（可依狀態、處理人、任務篩選）與所有提案 */
export function CollabPanel() {
  const panel = useUiStore((s) => s.collabPanel);
  const setPanel = useUiStore((s) => s.setCollabPanel);
  const { data: me } = useCurrentUser();
  const { data: members = [] } = useMembers();
  const { data: tasks = [] } = useTasks();
  const { data: issues = [] } = useIssues();
  const { data: proposals = [] } = useProposals();
  const memberMap = useMemberMap();
  const drawer = useTaskDrawer();
  const report = useDisclosure();
  const propose = useDisclosure();
  const [issueFilter, setIssueFilter] = useState<IssueFilter>('open');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [taskFilter, setTaskFilter] = useState('');
  const [proposalFilter, setProposalFilter] = useState<ProposalFilter>('open');
  const taskMap = useMemo(() => new Map<string, Task>(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]:not([data-panel])')) setPanel(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [panel, setPanel]);

  if (!panel || !me) return null;

  const openIssues = issues.filter(isOpenIssue).length;
  const openProposals = proposals.filter((p) => p.status === 'open').length;
  const shownIssues = issues.filter(
    (i) =>
      (issueFilter === 'all' || (issueFilter === 'open' ? isOpenIssue(i) : i.status === issueFilter)) &&
      (!ownerFilter || i.ownerId === ownerFilter) &&
      (!taskFilter || i.taskId === taskFilter),
  );
  const shownProposals = proposals.filter((p) => proposalFilter === 'all' || p.status === proposalFilter);
  const issueTaskIds = [...new Set(issues.map((i) => i.taskId))];

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-gray-900/30" onMouseDown={(e) => e.target === e.currentTarget && setPanel(null)}>
      <aside role="dialog" aria-modal="true" aria-label="問題與提案" data-panel className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-canvas sm:rounded-l-3xl">
        <header className="border-b border-gray-100 bg-white px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-gray-900">問題與提案</h2>
              <p className="mt-0.5 text-sm text-gray-500">Report → Assign Owner → Respond → Resolve / Replan；提案由 Leader 決策</p>
            </div>
            <IconButton aria-label="關閉" onClick={() => setPanel(null)}>
              <X className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl<'issues' | 'proposals'>
              size="sm"
              aria-label="分頁"
              value={panel}
              onChange={setPanel}
              options={[
                { value: 'issues', label: `問題（${openIssues}）` },
                { value: 'proposals', label: `提案（${openProposals}）` },
              ]}
            />
            {panel === 'issues' ? (
              <Button size="sm" variant="primary" onClick={report.open}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                回報問題
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={propose.open}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                提出提案
              </Button>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {panel === 'issues' ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Select value={issueFilter} onChange={(e) => setIssueFilter(e.target.value as IssueFilter)} aria-label="狀態" className="w-36">
                  <option value="open">未結案</option>
                  <option value="all">全部狀態</option>
                  {(Object.keys(ISSUE_STATUS) as IssueStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {ISSUE_STATUS[s].label}
                    </option>
                  ))}
                </Select>
                <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="處理人" className="w-36">
                  <option value="">所有處理人</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} aria-label="任務" className="w-36">
                  <option value="">所有任務</option>
                  {issueTaskIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </Select>
              </div>
              {shownIssues.length ? (
                shownIssues.map((i) => (
                  <IssueCard key={i.id} issue={i} task={taskMap.get(i.taskId)} members={members} memberMap={memberMap} me={me} onOpenTask={(id) => drawer.open(id, 'issues')} />
                ))
              ) : (
                <EmptyState icon={AlertTriangle} title="沒有符合條件的問題" />
              )}
            </>
          ) : (
            <>
              <Select value={proposalFilter} onChange={(e) => setProposalFilter(e.target.value as ProposalFilter)} aria-label="提案狀態" className="w-44">
                <option value="open">待決策</option>
                <option value="all">全部</option>
                {(Object.keys(PROPOSAL_STATUS) as ProposalStatus[])
                  .filter((s) => s !== 'open')
                  .map((s) => (
                    <option key={s} value={s}>
                      {PROPOSAL_STATUS[s].label}
                    </option>
                  ))}
              </Select>
              {shownProposals.length ? (
                shownProposals.map((p) => (
                  <ProposalCard key={p.id} proposal={p} task={p.taskId ? taskMap.get(p.taskId) : undefined} memberMap={memberMap} me={me} onOpenTask={(id) => drawer.open(id, 'issues')} />
                ))
              ) : (
                <EmptyState icon={Lightbulb} title="沒有符合條件的提案" />
              )}
            </>
          )}
        </div>
      </aside>
      <ReportIssueDialog open={report.isOpen} onClose={report.close} />
      <ProposalDialog open={propose.isOpen} onClose={propose.close} />
    </div>,
    document.body,
  );
}
