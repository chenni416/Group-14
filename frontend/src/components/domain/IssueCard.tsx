import { AlertTriangle, Check, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Badge, Button, Select, Tag, Textarea } from '@/components/ui';
import { useIssueActions } from '@/hooks/useCollab';
import { ISSUE_STATUS, ISSUE_TYPES, hoursSince, isOpenIssue, isStale } from '@/lib/collab';
import { mention, relativeTime } from '@/lib/format';
import { isLead } from '@/lib/permissions';
import type { Issue, Member, Task } from '@/types';

interface Props {
  issue: Issue;
  task: Task | undefined;
  members: Member[];
  memberMap: Map<string, Member>;
  me: Member;
  /** 點任務編號時開啟任務詳情 */
  onOpenTask?: (id: string) => void;
}

/** G4：單一問題的處理流程（Report → Assign Owner → Respond → Resolve / Replan） */
export function IssueCard({ issue, task, members, memberMap, me, onOpenTask }: Props) {
  const { assign, respond, resolve, replan } = useIssueActions();
  const [text, setText] = useState('');
  const [newOwner, setNewOwner] = useState(issue.ownerId ?? '');
  const lead = isLead(me);
  const open = isOpenIssue(issue);
  const owner = issue.ownerId ? memberMap.get(issue.ownerId) : undefined;
  const status = ISSUE_STATUS[issue.status];
  const canRespond = open && (issue.ownerId === me.id || lead);
  const canClose = open && (issue.reporterId === me.id || lead);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-gray-500">{issue.id}</span>
        {onOpenTask && task ? (
          <button type="button" onClick={() => onOpenTask(task.id)} className="font-mono text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline">
            {task.id}
          </button>
        ) : (
          <span className="font-mono text-gray-500">{issue.taskId}</span>
        )}
        <Tag>{ISSUE_TYPES[issue.type].label}</Tag>
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        {isStale(issue) && (
          <Badge tone="orange">
            <AlertTriangle className="h-3 w-3" strokeWidth={2} />
            已等待 {hoursSince(issue.updatedAt)} 小時
          </Badge>
        )}
        <span className="ml-auto text-gray-500">{relativeTime(issue.createdAt)}</span>
      </div>
      {task && <p className="mt-2 text-sm font-medium text-gray-900">{task.title}</p>}
      <p className="mt-1 text-sm text-gray-700">{issue.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          回報者
          <Avatar member={memberMap.get(issue.reporterId)} size="xs" />
          {mention(memberMap.get(issue.reporterId)?.name)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          處理人
          {owner ? (
            <>
              <Avatar member={owner} size="xs" />
              {mention(owner.name)}
            </>
          ) : (
            '尚未指派'
          )}
        </span>
      </div>
      {issue.ownerReason && <p className="mt-1 text-xs text-gray-500">推薦理由：{issue.ownerReason}</p>}

      {issue.responses.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {issue.responses.map((r) => (
            <li key={r.id} className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{mention(memberMap.get(r.byId)?.name)}</span>
              <span className="ml-2 text-xs text-gray-500">{relativeTime(r.at)}</span>
              <p className="mt-0.5">{r.text}</p>
            </li>
          ))}
        </ul>
      )}

      {canRespond && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="回應處理方式、提供資訊或說明下一步" aria-label="回應內容" />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={respond.isPending}
              onClick={() => respond.mutate({ id: issue.id, text }, { onSuccess: () => setText('') })}
            >
              送出回應
            </Button>
            {lead && (
              <>
                <Select value={newOwner} onChange={(e) => setNewOwner(e.target.value)} aria-label="改派處理人" className="w-40">
                  <option value="">選擇處理人</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" disabled={!newOwner || newOwner === issue.ownerId} loading={assign.isPending} onClick={() => assign.mutate({ id: issue.id, ownerId: newOwner })}>
                  {issue.ownerId ? '改派' : '指派'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {canClose && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" loading={resolve.isPending} onClick={() => resolve.mutate(issue.id)}>
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            已解決
          </Button>
          <Button size="sm" loading={replan.isPending} onClick={() => replan.mutate(issue.id)}>
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
            需重新規劃
          </Button>
        </div>
      )}
    </article>
  );
}
