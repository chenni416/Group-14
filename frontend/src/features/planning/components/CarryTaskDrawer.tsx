import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from '@/stores/toast.store';
import { Avatar, Badge, Button, Callout, Drawer, Input, Label, SegmentedControl, Select, StatusBadge } from '@/components/ui';
import { CARRY_POINTS_MAX, capOf, carryConfirmer, carryOwner, carrySP } from '@/lib/planning';
import type { Member, Sprint, Task } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { LANES, carryLaneOf } from '../lanes';

interface Props {
  task: Task | null;
  sprint: Sprint;
  members: Member[];
  /** 各成員在本輪的負載（正式任務 + 帶入任務），用來顯示改派後的點數 */
  load: Record<string, number>;
  onClose: () => void;
}

type Choice = 'carry' | 'defer';

/**
 * 上輪未完成任務的帶入／延後決定。
 * 送出派工前（規劃階段 3–5）可直接調整；送出後鎖定為唯讀，
 * 成員協商退回時，Leader 才能改為延後、帶入或改派並重新發送確認。
 */
export function CarryTaskDrawer({ task, sprint, members, load, onClose }: Props) {
  const { setCarry, resendCarry } = usePlanningMutations();
  const [choice, setChoice] = useState<Choice>('carry');
  const [owner, setOwner] = useState('');
  const [points, setPoints] = useState('');

  useEffect(() => {
    if (!task) return;
    setChoice(task.carry === false ? 'defer' : 'carry');
    setOwner(carryOwner(task));
    setPoints(String(carrySP(task)));
  }, [task]);

  if (!task) return null;

  const returned = task.carryStatus === 'returned';
  const planning = task.carryStatus == null;
  const editable = returned || planning;
  const lane = LANES.find((l) => l.key === carryLaneOf(task));
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const confirmer = memberMap.get(carryConfirmer(task));
  const original = memberMap.get(task.assigneeId);
  const sp = carrySP(task);
  const n = Number(points);
  const pointsValid = Number.isInteger(n) && n >= 1 && n <= CARRY_POINTS_MAX;
  const nextSp = pointsValid ? n : sp;
  const current = task.carry ? carryOwner(task) : null;
  const after = (id: string) => (load[id] ?? 0) - (id === current ? sp : 0) + nextSp;

  const input = choice === 'carry' ? { carry: true, assigneeId: owner, points: n } : { carry: false };
  const mutation = returned ? resendCarry : setCarry;
  const save = () =>
    mutation.mutate(
      { id: task.id, input },
      {
        onSuccess: (t) => {
          if (planning) toast(t.carry ? `已更新 ${t.id} 的帶入設定` : `${t.id} 已改為延後，不計入本輪`);
          onClose();
        },
      },
    );

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={
        <>
          <span className="font-mono text-gray-500">{task.id}</span>
          {lane && !planning && (
            <Badge tone={lane.tone} dot>
              {lane.label}
            </Badge>
          )}
          <span className="text-gray-500">上輪未完成</span>
        </>
      }
      title={returned ? '修改帶入或延後的決定' : planning ? '調整上輪帶入任務' : task.title}
      footer={
        editable ? (
          <>
            <Button onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              loading={mutation.isPending}
              disabled={choice === 'carry' && !pointsValid}
              onClick={save}
            >
              {returned && <Send className="h-4 w-4" strokeWidth={1.75} />}
              {returned ? '儲存並重新發送通知' : '儲存'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>關閉</Button>
        )
      }
    >
      <div className="space-y-5">
        {returned && task.negotiation && (
          <Callout tone="danger" title={`${memberMap.get(task.negotiation.byId)?.name ?? '成員'} 的協商備註`}>
            {task.negotiation.reason}
            {task.negotiation.suggestId && `（建議改由 ${memberMap.get(task.negotiation.suggestId)?.name} 處理）`}
          </Callout>
        )}
        {!editable && (
          <p className="text-sm text-gray-500">
            派工通知已送出，決定已鎖定；需由 {confirmer?.name ?? '成員'} 協商退回後才能修改。
          </p>
        )}

        {editable && <p className="text-sm font-medium text-gray-900">{task.title}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <section>
            <Label>上輪狀態</Label>
            <StatusBadge state={task.state} />
          </section>
          <section>
            <Label>原估點數</Label>
            <p className="text-sm tabular-nums text-gray-900">{task.storyPoints} SP</p>
          </section>
          <section>
            <Label>上輪負責人</Label>
            <p className="flex items-center gap-2 text-sm text-gray-900">
              <Avatar member={original} size="xs" />
              {original?.name ?? '—'}
            </p>
          </section>
        </div>

        <section>
          <Label>決定</Label>
          {editable ? (
            <SegmentedControl<Choice>
              size="sm"
              aria-label="帶入或延後"
              value={choice}
              onChange={setChoice}
              options={[
                { value: 'carry', label: '帶入本輪' },
                { value: 'defer', label: '延後' },
              ]}
            />
          ) : (
            <p className="text-sm text-gray-900">{task.carry ? '帶入本輪' : '延後到之後的 Sprint'}</p>
          )}
        </section>

        {(editable ? choice === 'carry' : task.carry) && (
          <section>
            <Label>本輪預估點數</Label>
            {editable ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={CARRY_POINTS_MAX}
                  aria-label="本輪預估點數"
                  className="h-9 w-20 px-2 tabular-nums"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
                <span className="text-sm text-gray-500">SP</span>
                {!pointsValid && <span className="text-xs text-red-600">請輸入 1 到 {CARRY_POINTS_MAX} 的整數</span>}
              </div>
            ) : (
              <p className="text-sm tabular-nums text-gray-900">{sp} SP</p>
            )}
            <p className="mt-1 text-xs text-gray-500">完成剩餘工作在本輪需要的點數，由 Leader 評估。</p>
          </section>
        )}

        {(editable ? choice === 'carry' : task.carry) && (
          <section>
            <Label>本輪負責人</Label>
            {editable ? (
              <Select aria-label="本輪負責人" value={owner} onChange={(e) => setOwner(e.target.value)}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.id === task.assigneeId ? '（原負責人）' : ''} · {after(m.id)}/{capOf(sprint, m)} SP
                  </option>
                ))}
              </Select>
            ) : (
              <p className="flex items-center gap-2 text-sm text-gray-900">
                <Avatar member={memberMap.get(carryOwner(task))} size="xs" />
                {memberMap.get(carryOwner(task))?.name ?? '—'}
              </p>
            )}
          </section>
        )}
        {planning && (
          <p className="text-xs text-gray-500">送出派工前可以隨時調整；送出後會通知成員確認，之後需由成員協商退回才能修改。</p>
        )}
        <p className="text-xs text-gray-500">決定在啟動 Sprint 時套用：帶入的任務移到本輪，點數改為本輪預估值並由新負責人處理，延後的任務寫進延續事項。</p>
      </div>
    </Drawer>
  );
}
