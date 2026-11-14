import { Send, Sparkles, Undo2 } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { mention } from '@/lib/format';
import { changesSinceReturn } from '@/lib/planning';
import type { Member, Sprint, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { DraftTaskCard } from './DraftTaskCard';

interface Props {
  tasks: Task[];
  sprint: Sprint;
  members: Member[];
  memberMap: Map<string, Member>;
  load: Record<string, number>;
  isLead: boolean;
  leaderName?: string;
  flagged: boolean;
  onShowSource: (source: string) => void;
}

/** 協商退回：Leader 可修改內容與分配，再改派或重新發送給原成員 */
export function ReturnedTasks({ tasks, memberMap, isLead, ...cardProps }: Props) {
  const { updateTask, suggestAssignee, resetReturn, resend } = usePlanningMutations();
  if (!tasks.length) return null;
  const nameOf = (id: string) => memberMap.get(id)?.name ?? '未指派';

  return (
    <section className="mb-6 rounded-3xl border border-red-200 bg-red-50/30 p-4" aria-label="協商退回">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
          <Undo2 className="h-4 w-4" strokeWidth={2} />
          協商退回（{tasks.length}）
        </h3>
        <span className="text-xs text-gray-500">可修改內容與分配，再改派或重新發送給原成員</span>
      </div>
      <div className="space-y-5">
        {tasks.map((t) => {
          const n = t.negotiation;
          const changes = changesSinceReturn(t, nameOf);
          const same = !!n && t.assigneeId === n.byId;
          return (
            <div key={t.id} className="space-y-2">
              {n && (
                <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
                  <Avatar member={memberMap.get(n.byId)} size="xs" />
                  <p>
                    <span className="font-medium">{mention(memberMap.get(n.byId)?.name)} 提出協商：</span>
                    {n.reason}
                    {n.suggestId && `（建議改由 ${mention(memberMap.get(n.suggestId)?.name)} 處理）`}
                  </p>
                </div>
              )}
              <DraftTaskCard task={t} memberMap={memberMap} isLead={isLead} {...cardProps} />
              {isLead && (
                <div className="rounded-2xl bg-white p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {n?.suggestId && t.assigneeId !== n.suggestId && (
                      <Button size="xs" onClick={() => updateTask.mutate({ id: t.id, patch: { assigneeId: n.suggestId! } })}>
                        改派給建議人選 {mention(memberMap.get(n.suggestId)?.name)}
                      </Button>
                    )}
                    <Button size="xs" loading={suggestAssignee.isPending} onClick={() => suggestAssignee.mutate(t.id)}>
                      <Sparkles className="h-3 w-3" strokeWidth={2} />
                      AI 重新建議負責人
                    </Button>
                    {changes.length > 0 && (
                      <Button size="xs" onClick={() => resetReturn.mutate(t.id)}>
                        <Undo2 className="h-3 w-3" strokeWidth={1.75} />
                        復原修改
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="min-w-[180px] flex-1 text-xs text-gray-600">
                      {changes.length ? (
                        <>
                          <span className="font-semibold text-gray-900">已修改：</span>
                          {changes.join('、')}
                        </>
                      ) : same ? (
                        '尚未修改內容。若要再交給同一位成員，請先調整點數、驗收條件等內容。'
                      ) : (
                        '尚未修改內容'
                      )}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!t.assigneeId}
                      loading={resend.isPending}
                      onClick={() => resend.mutate(t.id)}
                    >
                      <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {!t.assigneeId ? '請先選擇負責人' : same ? `修改後重新發送給 ${mention(nameOf(t.assigneeId))}` : `發送給 ${mention(nameOf(t.assigneeId))}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
