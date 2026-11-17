import { useState } from 'react';
import { Avatar, Badge, Button, Select, Tag, Textarea } from '@/components/ui';
import { useProposalActions } from '@/hooks/useCollab';
import { PROPOSAL_KINDS, PROPOSAL_STATUS } from '@/lib/collab';
import { mention, relativeTime } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import type { DecideProposalInput, Member, Proposal, Task } from '@/types';

interface Props {
  proposal: Proposal;
  task: Task | undefined;
  memberMap: Map<string, Member>;
  me: Member;
  onOpenTask?: (id: string) => void;
}

const DECISIONS: { value: DecideProposalInput['decision']; label: string }[] = [
  { value: 'adopted', label: '採納' },
  { value: 'rejected', label: '不採納' },
  { value: 'nextSprint', label: '納入下一個 Sprint' },
];

/** G4：提案、討論與決策紀錄（任何人可以提案與留言，Leader / PO 決策） */
export function ProposalCard({ proposal, task, memberMap, me, onOpenTask }: Props) {
  const { comment, decide } = useProposalActions();
  const [text, setText] = useState('');
  const [decision, setDecision] = useState<DecideProposalInput['decision']>('adopted');
  const [reason, setReason] = useState('');
  const status = PROPOSAL_STATUS[proposal.status];
  const open = proposal.status === 'open';
  const author = memberMap.get(proposal.authorId);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-gray-500">{proposal.id}</span>
        <Tag>{PROPOSAL_KINDS[proposal.kind]}</Tag>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        {task && (
          <button type="button" onClick={() => onOpenTask?.(task.id)} className="font-mono text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">
            {task.id}
          </button>
        )}
        <span className="ml-auto text-gray-500">{relativeTime(proposal.createdAt)}</span>
      </div>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{proposal.title}</h3>
      {proposal.description && <p className="mt-1 text-sm text-gray-700">{proposal.description}</p>}
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500">
        <Avatar member={author} size="xs" />
        {mention(author?.name)} 提出
      </p>

      {proposal.comments.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {proposal.comments.map((c) => (
            <li key={c.id} className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{mention(memberMap.get(c.byId)?.name)}</span>
              <span className="ml-2 text-xs text-gray-500">{relativeTime(c.at)}</span>
              <p className="mt-0.5">{c.text}</p>
            </li>
          ))}
        </ul>
      )}

      {!open && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span className="text-xs font-semibold text-gray-500">決策 · {mention(memberMap.get(proposal.decidedById ?? '')?.name)}</span>
          <p className="mt-0.5">{proposal.decision}</p>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <div className="flex gap-2">
            <Textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="留言討論" aria-label="留言" className="min-h-10" />
            <Button
              size="sm"
              className="self-end"
              loading={comment.isPending}
              disabled={!text.trim()}
              onClick={() => comment.mutate({ id: proposal.id, text }, { onSuccess: () => setText('') })}
            >
              留言
            </Button>
          </div>
          {isLead(me) && (
            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Leader / PO 決策</p>
              <Select value={decision} onChange={(e) => setDecision(e.target.value as DecideProposalInput['decision'])} aria-label="決策">
                {DECISIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="決策理由（必填）" aria-label="決策理由" />
              <Button
                size="sm"
                variant="primary"
                loading={decide.isPending}
                onClick={() => decide.mutate({ id: proposal.id, input: { decision, reason } }, { onSuccess: () => setReason('') })}
              >
                記錄決策
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
