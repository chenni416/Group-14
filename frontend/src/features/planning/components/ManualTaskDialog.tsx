import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { DOMAIN_KEYS, DOMAINS, STORY_POINT_OPTIONS } from '@/lib/constants';
import { bulletLines, capOf, stripCarryNote } from '@/lib/planning';
import type { Domain, Member, ReviewPolicy, Sprint } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { EditableField } from './EditableField';
import { ReviewPolicyEditor } from './ReviewPolicyEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 開啟時預先帶入的來源句（從會議紀錄截取） */
  initialSource: string;
  sprint: Sprint;
  members: Member[];
  load: Record<string, number>;
  defaultPolicy: ReviewPolicy;
  leaderName?: string;
}

/** 右上角「＋ 新增任務」：Leader 填寫標題、驗收條件、點數與理由、負責人、Review 策略與來源句 */
export function ManualTaskDialog({ open, onClose, initialSource, sprint, members, load, defaultPolicy, leaderName }: Props) {
  const { createTask } = usePlanningMutations();
  const [title, setTitle] = useState('');
  const [ac, setAc] = useState('');
  const [domain, setDomain] = useState<Domain>('FE');
  const [sp, setSp] = useState(2);
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [policy, setPolicy] = useState<ReviewPolicy>(defaultPolicy);
  const [source, setSource] = useState('');

  useEffect(() => {
    if (!open) return;
    const src = stripCarryNote(initialSource);
    setTitle(src.slice(0, 40));
    setSource(src);
    setAc('');
    setReason('');
    setAssigneeId('');
    setPolicy({ ...defaultPolicy, targets: [...defaultPolicy.targets] });
  }, [open, initialSource, defaultPolicy]);

  const candidates = bulletLines(sprint.minutes).map(stripCarryNote);

  const submit = () =>
    createTask.mutate(
      {
        title,
        domain,
        storyPoints: sp,
        storyPointsReason: reason,
        assigneeId,
        acceptanceCriteria: ac.split('\n').map((s) => s.trim()).filter(Boolean),
        policy,
        source,
      },
      { onSuccess: onClose },
    );

  return (
    <Modal open={open} onClose={onClose} title="新增任務" description="Leader 手動填寫，會以「Leader 新增」草稿加入，與 AI 任務一起核准。" className="max-w-2xl">
      <div className="space-y-3">
        <EditableField label="標題">
          <Input aria-label="標題" value={title} placeholder="例如：Review 逾時自動轉入公共池" onChange={(e) => setTitle(e.target.value)} />
        </EditableField>
        <EditableField label="驗收條件（每行一條）">
          <Textarea aria-label="驗收條件" rows={3} className="text-xs" value={ac} placeholder="例如：超過 48 小時未審查自動通知 Leader" onChange={(e) => setAc(e.target.value)} />
        </EditableField>
        <EditableField label="領域、點數與估點理由">
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Select aria-label="領域" className="w-28 shrink-0" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>
              {DOMAIN_KEYS.map((d) => (
                <option key={d} value={d}>
                  {DOMAINS[d].label}
                </option>
              ))}
            </Select>
            <Select aria-label="Story Points" className="w-20 shrink-0" value={sp} onChange={(e) => setSp(Number(e.target.value))}>
              {STORY_POINT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
            <Input aria-label="估點理由" className="text-xs" placeholder="估點理由" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </EditableField>
        <EditableField label="負責人">
          <Select aria-label="負責人" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">未指派</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {load[m.id] ?? 0}/{capOf(sprint, m)} SP
              </option>
            ))}
          </Select>
        </EditableField>
        <EditableField label="Review 策略與審查人員">
          <ReviewPolicyEditor id="mt-policy" value={policy} onChange={setPolicy} members={members} assigneeId={assigneeId} leaderName={leaderName} />
        </EditableField>
        <EditableField label="來源句（從左側會議紀錄截取）">
          <Select
            aria-label="從會議紀錄選一句"
            value={candidates.includes(source) ? source : ''}
            onChange={(e) => {
              setSource(e.target.value);
              if (!title.trim()) setTitle(e.target.value.slice(0, 40));
            }}
          >
            <option value="">— 從會議紀錄選一句 —</option>
            {candidates.map((l, i) => (
              <option key={`${l}-${i}`} value={l}>
                {l.length > 46 ? `${l.slice(0, 46)}…` : l}
              </option>
            ))}
          </Select>
          <Textarea
            aria-label="來源句"
            rows={2}
            className="mt-2 text-xs"
            value={source}
            placeholder="也可以在左側「對照來源句」反白文字後再按＋新增任務"
            onChange={(e) => setSource(e.target.value)}
          />
        </EditableField>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={createTask.isPending} onClick={submit}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            加入任務
          </Button>
        </div>
      </div>
    </Modal>
  );
}
