import { CheckCircle2, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Button, EmptyState, Modal, StatusBadge } from '@/components/ui';
import { sum } from '@/lib/format';
import type { Member, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';

interface Props {
  open: boolean;
  /** 上輪未完成、決定延後的任務 */
  carryDeferred: Task[];
  members: Member[];
  onClose: () => void;
}

const Group = ({ title, hint, children }: { title: string; hint: string; children: ReactNode }) => (
  <section>
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mb-2 mt-0.5 text-xs text-gray-500">{hint}</p>
    <ul className="space-y-2">{children}</ul>
  </section>
);

/**
 * 延後清單：本輪延後的 Story／Task 與上輪延後的任務。
 * 不離開目前階段即可檢視；送出派工前都能取消延後或改回帶入。
 */
export function DeferredListModal({ open, carryDeferred, members, onClose }: Props) {
  const { setCarry } = usePlanningMutations();
  const { draft, requestRestore } = usePlanningStore();
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const stories = draft?.stories.filter((x) => x.deferred) ?? [];
  const tasks = draft?.tasks.filter((x) => x.deferred) ?? [];
  const deferredStoryIds = new Set(stories.map((s) => s.id));
  const looseTasks = tasks.filter((t) => !deferredStoryIds.has(t.storyId));
  const empty = !stories.length && !looseTasks.length && !carryDeferred.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="延後清單"
      description="延後的項目本輪不處理，送出派工或啟動 Sprint 時會寫進延續事項，之後的 Sprint 可以在「上輪 Sprint 統整」再納入。"
    >
      {empty ? (
        <EmptyState icon={CheckCircle2} title="沒有延後的項目" description="本輪規劃的項目與上輪未完成任務都會在本輪處理。" />
      ) : (
        <div className="space-y-5">
          {(stories.length > 0 || looseTasks.length > 0) && (
            <Group title="本輪延後" hint="不計負載、不出現在 Team Capacity；取消延後即回到本輪與 Team Capacity。">
              {stories.map((s) => {
                const own = tasks.filter((t) => t.storyId === s.id);
                return (
                  <li key={s.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-xs text-gray-500">{s.code}</span>
                      <span className="min-w-0 flex-1 text-sm text-gray-900">{s.title}</span>
                      <Button size="xs" aria-label={`取消延後 ${s.code}`} onClick={() => requestRestore('story', s.id)}>
                        <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        取消延後
                      </Button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Story ·{' '}
                      {own.length ? `${own.length} 張 Task · ${sum(own.map((t) => t.storyPoints))} SP` : `預估 ${s.storyPoints} SP，尚未拆解 Task`}
                    </p>
                  </li>
                );
              })}
              {looseTasks.map((t) => (
                <li key={t.id} className="rounded-2xl border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-xs text-gray-500">{t.code}</span>
                    <span className="min-w-0 flex-1 text-sm text-gray-900">{t.title}</span>
                    <Button size="xs" aria-label={`取消延後 ${t.code}`} onClick={() => requestRestore('task', t.id)}>
                      <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      取消延後
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">Task · {t.storyPoints} SP</p>
                </li>
              ))}
            </Group>
          )}
          {carryDeferred.length > 0 && (
            <Group title="上輪延後" hint="上輪未完成、決定延後的任務，啟動 Sprint 時寫進延續事項。">
              {carryDeferred.map((t) => {
                const owner = memberMap.get(t.assigneeId);
                const pending = setCarry.isPending && setCarry.variables?.id === t.id;
                return (
                  <li key={t.id} className="rounded-2xl border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-xs text-gray-500">{t.id}</span>
                      <span className="min-w-0 flex-1 text-sm text-gray-900">{t.title}</span>
                      <StatusBadge state={t.state} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Avatar member={owner} size="xs" />
                        {owner?.name ?? '未指派'}
                      </span>
                      <span className="tabular-nums">原估 {t.storyPoints} SP</span>
                      {t.carryStatus == null && (
                        <Button
                          size="xs"
                          className="ml-auto"
                          loading={pending}
                          aria-label={`${t.id} 改回帶入本輪`}
                          onClick={() => setCarry.mutate({ id: t.id, input: { carry: true } })}
                        >
                          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                          改回帶入本輪
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </Group>
          )}
        </div>
      )}
    </Modal>
  );
}
