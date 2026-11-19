import { CheckCircle2, History, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, Button, Card } from '@/components/ui';
import { useSprintContext } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { capOf, carryLoad, carryOwner, carrySP, loadByMember, overloadPlans, type LoadItem, type OverloadAction } from '@/lib/planning';
import { toast } from '@/stores/toast.store';
import type { Member } from '@/types';
import { useAssignDraftTask } from '../hooks/useAssignDraftTask';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';
import { CarryTaskDrawer } from './CarryTaskDrawer';
import { PlanTaskDrawer } from './PlanTaskDrawer';

const ACTION_BADGE: Record<OverloadAction['kind'], { label: string; className: string }> = {
  reassign: { label: '建議改派', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  defer: { label: '建議延後', className: 'border-orange-200 bg-orange-50 text-orange-700' },
  keep: { label: '建議維持', className: 'border-gray-200 bg-gray-50 text-gray-600' },
};

/**
 * 派工總覽的超載檢查：只列出超載成員（多位時點選切換）。
 * 左側為該成員的任務（收合列出重點，點開可手動調整），右側為 AI 建議的處理方式，逐項點選確認套用。
 */
export function OverloadCheck({ members }: { members: Member[] }) {
  const draft = usePlanningStore((s) => s.draft);
  const requestDefer = usePlanningStore((s) => s.requestDefer);
  const { planning, carryTasks } = useSprintContext();
  const { setCarry, updateSprint } = usePlanningMutations();
  const assign = useAssignDraftTask(members);
  const [selected, setSelected] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openCarry, setOpenCarry] = useState<string | null>(null);

  const data = useMemo(() => {
    const tasks = (draft?.tasks ?? []).filter((t) => !t.deferred);
    const carried = carryTasks.filter((t) => t.carry === true);
    const caps = Object.fromEntries(members.map((m) => [m.id, capOf(planning, m)]));
    const draftLoad = loadByMember(members, tasks);
    const cLoad = carryLoad(members, carryTasks);
    const load = Object.fromEntries(members.map((m) => [m.id, (draftLoad[m.id] ?? 0) + (cLoad[m.id] ?? 0)]));
    const ownerOf = new Map<string, string>([
      ...tasks.filter((t) => t.assigneeId).map((t) => [t.id, t.assigneeId!] as [string, string]),
      ...carried.map((t) => [t.id, carryOwner(t)] as [string, string]),
    ]);
    const codeOf = new Map<string, string>([...tasks.map((t) => [t.id, t.code] as [string, string]), ...carried.map((t) => [t.id, t.id] as [string, string])]);
    const unlocksOf = (id: string) => tasks.filter((t) => t.dependsOn.some((d) => d.id === id)).map((t) => t.id);
    const items: LoadItem[] = [
      ...tasks
        .filter((t) => t.assigneeId)
        .map((t) => {
          const prev = t.dependsOn.find((d) => ownerOf.get(d.id) === t.assigneeId);
          return {
            id: t.id,
            code: t.code,
            title: t.title,
            points: t.storyPoints,
            domain: t.domain,
            carry: false,
            assigneeId: t.assigneeId!,
            unlocks: unlocksOf(t.id),
            continues: prev ? (codeOf.get(prev.id) ?? null) : null,
            suggested: t.suggestedAssigneeId === t.assigneeId,
          };
        }),
      ...carried.map((t) => ({
        id: t.id,
        code: t.id,
        title: t.title,
        points: carrySP(t),
        domain: t.domain,
        carry: true,
        assigneeId: carryOwner(t),
        unlocks: unlocksOf(t.id),
        continues: null,
        suggested: carryOwner(t) === t.assigneeId,
      })),
    ];
    const fullMembers = members.map((m) => ({ ...m, capacity: caps[m.id] ?? m.capacity }));
    return { plans: overloadPlans(members, caps, load, items), load, fullMembers, tasks, carried };
  }, [draft, carryTasks, members, planning]);

  const { plans, load, fullMembers, tasks, carried } = data;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? '成員';

  if (!plans.length)
    return (
      <Card className="mb-5 flex items-center gap-2 border-emerald-200 bg-emerald-50/70 px-5 py-4 text-sm text-emerald-800" role="status">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
        <span className="font-medium">超載檢查完成</span>
        <span className="text-emerald-700">· 所有成員都在本輪 Capacity 內</span>
      </Card>
    );

  const plan = plans.find((p) => p.memberId === selected) ?? plans[0]!;
  const member = members.find((m) => m.id === plan.memberId);
  const changes = plan.items.filter((x) => x.action.kind !== 'keep');
  const kept = plan.items.filter((x) => x.action.kind === 'keep');

  const apply = (item: LoadItem, action: OverloadAction) => {
    if (action.kind === 'reassign') {
      if (item.carry) setCarry.mutate({ id: item.id, input: { carry: true, assigneeId: action.to } }, { onSuccess: () => toast(`已將 ${item.code} 改派給 ${nameOf(action.to)}`) });
      else assign(item.id, action.to);
    } else if (action.kind === 'defer') {
      if (item.carry) setCarry.mutate({ id: item.id, input: { carry: false } }, { onSuccess: () => toast(`${item.code} 已改為延後`) });
      else requestDefer('task', item.id);
    }
  };
  const raiseCapacity = () =>
    planning &&
    updateSprint.mutate(
      { id: planning.id, patch: { capacity: { ...planning.capacity, [plan.memberId]: plan.load } } },
      { onSuccess: () => toast(`已將 ${member?.name ?? '成員'} 本輪點數調為 ${plan.load} SP`) },
    );

  const capacityOption = (
    <div className={cn('rounded-2xl border p-3', plan.preferCapacity ? 'border-sky-200 bg-sky-50/40' : 'border-gray-100')}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium text-gray-900">
            {plan.preferCapacity && <span className="mr-1.5 text-sky-700">建議</span>}
            調高 {member?.name} 本輪點數 {plan.cap} → {plan.load} SP
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            任務都不動。{plan.excess <= 2 ? `只超出 ${plan.excess} SP，` : ''}適合本人願意多承擔的情況，請先與成員確認。
          </p>
        </div>
        <Button size="xs" loading={updateSprint.isPending} aria-label={`確認調高 ${member?.name} 本輪點數`} onClick={raiseCapacity}>
          確認
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="mb-5 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">超載檢查</h2>
        <p className="text-xs text-gray-500">
          {plans.length} 位成員超過本輪 Capacity。左側為該成員負責的任務，右側為 AI 建議的處理方式；也可以點開任務卡手動調整。
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="超載成員">
        {plans.map((p) => {
          const active = p.memberId === plan.memberId;
          return (
            <button
              key={p.memberId}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(p.memberId)}
              className={cn(
                'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition-colors duration-150',
                active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              <Avatar member={members.find((m) => m.id === p.memberId)} size="xs" />
              {nameOf(p.memberId)}
              <span className={cn('text-xs tabular-nums', active ? 'text-red-200' : 'text-red-600')}>
                {p.load}/{p.cap} SP · +{p.excess}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label={`${member?.name} 的任務`}>
          <p className="mb-2 text-xs font-medium text-gray-500">
            {member?.name} 的任務 · {plan.items.length} 項 · {plan.load} SP
          </p>
          <ul className="space-y-2">
            {plan.items.map(({ item, action }) => {
              const badge = ACTION_BADGE[action.kind];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-label={`開啟 ${item.code}`}
                    onClick={() => (item.carry ? setOpenCarry(item.id) : setOpenTask(item.id))}
                    className={cn(
                      'flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-white px-3 py-2.5 text-left transition-colors duration-150 hover:border-gray-300',
                      item.carry ? 'border-dashed border-gray-300' : 'border-gray-100',
                    )}
                  >
                    <span className="font-mono text-xs text-gray-500">{item.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{item.title}</span>
                    {item.carry && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <History className="h-3 w-3" strokeWidth={1.75} />
                        上輪帶入
                      </span>
                    )}
                    <span className="text-xs font-medium tabular-nums text-gray-700">{item.points} SP</span>
                    <span className={cn('inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium', badge.className)}>
                      {badge.label}
                      {action.kind === 'reassign' && ` → ${nameOf(action.to)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="AI 建議">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            AI 建議
          </p>
          <p className="mb-3 text-sm text-gray-700">
            {member?.name} 超載 {plan.excess} SP。
            {changes.length
              ? plan.resolved
                ? `照下列 ${changes.length} 項調整即可解除超載，逐項確認後套用。`
                : `下列調整仍無法完全解除超載，建議搭配調高本輪點數。`
              : '任務都適合由本人處理，建議調高本輪點數或與成員討論。'}
          </p>
          <div className="space-y-2">
            {plan.preferCapacity && capacityOption}
            {changes.map(({ item, action }) => (
              <div key={item.id} className="rounded-2xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-gray-900">
                      {action.kind === 'reassign' ? `改派 ${item.code} 給 ${nameOf(action.to)}` : `延後 ${item.code}`}
                      <span className="ml-1.5 font-normal text-gray-500">· {item.points} SP</span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">{action.reason}</p>
                  </div>
                  <Button size="xs" variant="primary" aria-label={`確認${action.kind === 'reassign' ? '改派' : '延後'} ${item.code}`} onClick={() => apply(item, action)}>
                    確認
                  </Button>
                </div>
              </div>
            ))}
            {!plan.preferCapacity && (
              <>
                <p className="pt-1 text-xs text-gray-500">或改用另一種方式：</p>
                {capacityOption}
              </>
            )}
          </div>
          {kept.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-gray-500">建議維持（不用更動）</p>
              <ul className="space-y-1">
                {kept.map(({ item, action }) => (
                  <li key={item.id} className="text-xs text-gray-600">
                    <span className="font-mono text-gray-500">{item.code}</span> {action.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <PlanTaskDrawer
        task={tasks.find((t) => t.id === openTask) ?? null}
        members={fullMembers}
        load={load}
        allowUnassign={false}
        onAssign={assign}
        onClose={() => setOpenTask(null)}
      />
      {planning && (
        <CarryTaskDrawer task={carried.find((t) => t.id === openCarry) ?? null} sprint={planning} members={members} load={load} onClose={() => setOpenCarry(null)} />
      )}
    </Card>
  );
}
