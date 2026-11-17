import { useEffect, useState } from 'react';
import { Button, Callout, Field, Input, Modal, SegmentedControl, Select, Textarea } from '@/components/ui';
import { useCurrentUser, useMembers, useSprintContext } from '@/hooks/queries';
import { useIssueActions, useProposalActions } from '@/hooks/useCollab';
import { ISSUE_TYPES, PROPOSAL_KINDS } from '@/lib/collab';
import { BOARD_STATES, type IssueType, type ProposalKind } from '@/types';

interface IssueProps {
  open: boolean;
  onClose: () => void;
  /** 預先選好任務（從卡片或任務詳情回報時） */
  taskId?: string;
}

/** G4：回報問題（類型、描述、影響的任務、想請的人） */
export function ReportIssueDialog({ open, onClose, taskId }: IssueProps) {
  const { report } = useIssueActions();
  const ctx = useSprintContext();
  const { data: members = [] } = useMembers();
  const { data: me } = useCurrentUser();
  const [task, setTask] = useState(taskId ?? '');
  const [type, setType] = useState<IssueType>('tech');
  const [description, setDescription] = useState('');
  const [prefer, setPrefer] = useState('');

  useEffect(() => {
    if (open) {
      setTask(taskId ?? '');
      setType('tech');
      setDescription('');
      setPrefer('');
    }
  }, [open, taskId]);

  const tasks = ctx.allTasks.filter((t) => (BOARD_STATES as readonly string[]).includes(t.state) && t.state !== 'DONE');

  return (
    <Modal open={open} onClose={onClose} title="回報問題" description="說明遇到的阻礙，系統會推薦處理人並通知對方。">
      <div className="space-y-4">
        <Field label="影響的任務" htmlFor="is-task">
          <Select id="is-task" value={task} onChange={(e) => setTask(e.target.value)} disabled={!!taskId}>
            <option value="">選擇任務</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="問題類型">
          <SegmentedControl<IssueType>
            size="sm"
            aria-label="問題類型"
            value={type}
            onChange={setType}
            options={(Object.keys(ISSUE_TYPES) as IssueType[]).map((k) => ({ value: k, label: ISSUE_TYPES[k].label }))}
          />
          <p className="mt-1.5 text-xs text-gray-500">{ISSUE_TYPES[type].hint}</p>
        </Field>
        <Field label="描述" htmlFor="is-desc">
          <Textarea id="is-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="發生了什麼事？已經試過什麼？" />
        </Field>
        <Field label="想請誰協助（選填）" htmlFor="is-prefer">
          <Select id="is-prefer" value={prefer} onChange={(e) => setPrefer(e.target.value)}>
            <option value="">交給系統推薦</option>
            {members
              .filter((m) => m.id !== me?.id)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.title}
                </option>
              ))}
          </Select>
        </Field>
        <Callout tone="ai" title="系統如何推薦處理人">
          前置依賴 → 被依賴任務的負責人；其他 → 同領域且剩餘容量最多的成員；找不到時指給 Leader。Leader 之後可以改派。
        </Callout>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            loading={report.isPending}
            disabled={!task}
            onClick={() => report.mutate({ taskId: task, type, description, preferOwnerId: prefer || null }, { onSuccess: onClose })}
          >
            送出回報
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface ProposalProps {
  open: boolean;
  onClose: () => void;
  taskId?: string;
}

/** G4：提出新想法、改善建議或需求變更（任何角色都可以） */
export function ProposalDialog({ open, onClose, taskId }: ProposalProps) {
  const { create } = useProposalActions();
  const ctx = useSprintContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<ProposalKind>('idea');
  const [task, setTask] = useState(taskId ?? '');

  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setKind('idea');
      setTask(taskId ?? '');
    }
  }, [open, taskId]);

  const tasks = ctx.allTasks.filter((t) => t.sprintId === ctx.active?.id);

  return (
    <Modal open={open} onClose={onClose} title="提出提案" description="任何成員都可以提案；Leader 或 PO 會決策，結果與理由都會保留。">
      <div className="space-y-4">
        <Field label="類型">
          <SegmentedControl<ProposalKind>
            size="sm"
            aria-label="提案類型"
            value={kind}
            onChange={setKind}
            options={(Object.keys(PROPOSAL_KINDS) as ProposalKind[]).map((k) => ({ value: k, label: PROPOSAL_KINDS[k] }))}
          />
        </Field>
        <Field label="標題" htmlFor="pp-title">
          <Input id="pp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句話說明你的想法" />
        </Field>
        <Field label="說明" htmlFor="pp-desc">
          <Textarea id="pp-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="為什麼需要？會影響哪些部分？" />
        </Field>
        <Field label="關聯任務（選填）" htmlFor="pp-task">
          <Select id="pp-task" value={task} onChange={(e) => setTask(e.target.value)} disabled={!!taskId}>
            <option value="">不指定</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} {t.title}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            loading={create.isPending}
            onClick={() => create.mutate({ title, description, kind, taskId: task || null }, { onSuccess: onClose })}
          >
            送出提案
          </Button>
        </div>
      </div>
    </Modal>
  );
}
