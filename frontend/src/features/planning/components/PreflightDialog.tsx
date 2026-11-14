import { CheckCircle2, Send, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Badge, Button, Modal } from '@/components/ui';
import { sum } from '@/lib/format';
import type { PreflightResult } from '@/lib/planning';
import type { Task } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  result: PreflightResult;
  capacity: number;
  taskMap: Map<string, Task>;
  /** 回到分配頁面並以紅框標出問題 */
  onBack: () => void;
  onApprove: () => void;
  approving: boolean;
}

function Section({ title, required, children }: { title: string; required: boolean; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Badge tone={required ? 'red' : 'orange'} dot>
          {required ? '必須處理' : '可略過'}
        </Badge>
        {title}
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

/** ④ 核准前檢查：超量、缺負責人或驗收條件、待釐清問題未回答必須處理；相依性風險可略過 */
export function PreflightDialog({ open, onClose, result, capacity, taskMap, onBack, onApprove, approving }: Props) {
  const { drafts, over, missing, unanswered, risky, blocked } = result;
  const clean = !blocked && !risky.length;
  return (
    <Modal open={open} onClose={onClose} title="核准前檢查" description={`將核准 ${drafts.length} 項任務（${sum(drafts.map((t) => t.storyPoints))} SP）並發送指派邀請，本次 Capacity ${capacity} SP。`} className="max-w-xl">
      {clean && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          檢查通過，沒有發現問題
        </p>
      )}
      {unanswered.length > 0 && (
        <Section title="待釐清問題未回答" required>
          {unanswered.map((q) => (
            <li key={q.id} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              {q.question}
            </li>
          ))}
        </Section>
      )}
      {over.length > 0 && (
        <Section title="有人超過點數上限" required>
          {over.map(({ member, load, cap }) => (
            <li key={member.id} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <Avatar member={member} size="xs" />
              <span className="font-medium">{member.name}</span>
              <span className="ml-auto tabular-nums">
                {load}/{cap} SP（超出 {load - cap}）
              </span>
            </li>
          ))}
        </Section>
      )}
      {missing.length > 0 && (
        <Section title="缺少負責人或驗收條件" required>
          {missing.map(({ task, problems }) => (
            <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              <span className="font-mono text-xs">{task.id}</span>
              <span className="min-w-0 flex-1">{task.title}</span>
              <span className="text-xs">{problems.join('、')}</span>
            </li>
          ))}
        </Section>
      )}
      {risky.length > 0 && (
        <Section title="相依性風險" required={false}>
          {risky.map((d) => (
            <li key={`${d.taskId}-${d.dependsOnId}`} className="rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800">
              <span className="font-mono text-xs">{d.taskId}</span> {taskMap.get(d.taskId)?.title} 依賴已延後的 {d.dependsOnId}
            </li>
          ))}
        </Section>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {blocked ? (
          <>
            <span className="text-xs text-red-600">紅色項目處理完才能核准</span>
            <Button variant="primary" onClick={onBack}>
              <Undo2 className="h-4 w-4" strokeWidth={1.75} />
              回到分配頁面
            </Button>
          </>
        ) : (
          <>
            <Button onClick={risky.length ? onBack : onClose}>{risky.length ? '回到分配頁面' : '取消'}</Button>
            <Button variant="primary" loading={approving} onClick={onApprove}>
              <Send className="h-4 w-4" strokeWidth={1.75} />
              {risky.length ? '略過警告並核准' : '確認核准並發送'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
