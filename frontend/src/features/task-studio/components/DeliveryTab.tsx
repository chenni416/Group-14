import { ExternalLink, GitPullRequest, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { useAcceptanceCheck, useAcceptanceRecords, useExecutionPlans, useIssues } from '@/hooks/useCollab';
import { useTaskActions } from '@/hooks/useTaskActions';
import { AC_VERDICT, TEST_STATUS, isOpenIssue } from '@/lib/collab';
import { REVIEW_POLICIES } from '@/lib/constants';
import { checklistProgress } from '@/lib/execution';
import { mention, relativeTime } from '@/lib/format';
import { canReview } from '@/lib/permissions';
import { useUiStore } from '@/stores/ui.store';
import type { AcceptanceCheck, AcVerdict, Member, SubmitDeliveryInput, Task } from '@/types';

interface Props {
  task: Task;
  me: Member;
  memberMap: Map<string, Member>;
}

/** G5（成員端）：送審時提交交付內容。PR 連結只是文字輸入，不串 GitHub。 */
function DeliveryForm({ task }: { task: Task }) {
  const { submitReview } = useTaskActions();
  const { data: plans = [] } = useExecutionPlans();
  const { data: issues = [] } = useIssues();
  const prev = task.delivery;
  const [form, setForm] = useState<SubmitDeliveryInput>({
    prUrl: prev?.prUrl ?? '',
    deliverables: task.deliverables.map((text) => ({ text, provided: prev?.deliverables.find((d) => d.text === text)?.provided ?? false })),
    testNote: prev?.testNote ?? '',
    unfinished: prev?.unfinished ?? '',
    questions: prev?.questions ?? '',
  });

  const plan = plans.find((p) => p.taskId === task.id);
  const progress = checklistProgress(plan);
  const openIssues = issues.filter((i) => i.taskId === task.id && isOpenIssue(i)).length;
  const warnings = [
    !form.prUrl.trim() && '還沒有填 PR 連結（必填）',
    form.deliverables.some((d) => !d.provided) && '有交付物尚未提供',
    plan && progress.done < progress.total && `執行計畫的 Checklist 還有 ${progress.total - progress.done} 項沒完成`,
    openIssues > 0 && `還有 ${openIssues} 個問題尚未結案`,
    !form.testNote.trim() && '沒有填寫測試結果說明',
  ].filter((w): w is string => !!w);

  return (
    <Card className="space-y-4 p-5">
      <CardHeader title="提交交付並送審" description={`送出後將套用審查策略：${REVIEW_POLICIES[task.policy.mode].label}`} className="mb-0" />
      <Field label="PR 連結" htmlFor="dl-pr">
        <Input id="dl-pr" value={form.prUrl} onChange={(e) => setForm({ ...form, prUrl: e.target.value })} placeholder="https://github.com/atlab/taskline/pull/123" />
        <p className="mt-1 text-xs text-gray-500">原型中只記錄文字，不會連到 GitHub；PR 內容與測試結果由 mock 資料產生。</p>
      </Field>
      <div>
        <div className="mb-1.5 text-xs font-medium text-gray-500">交付物（逐項對應任務的 Deliverables）</div>
        <ul className="space-y-1.5">
          {form.deliverables.map((d, i) => (
            <li key={d.text}>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={d.provided}
                  onChange={(e) => setForm({ ...form, deliverables: form.deliverables.map((x, k) => (k === i ? { ...x, provided: e.target.checked } : x)) })}
                  className="h-4 w-4 rounded border-gray-300 accent-neutral-900"
                />
                {d.text}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <Field label="測試結果說明" htmlFor="dl-test">
        <Textarea id="dl-test" rows={2} value={form.testNote} onChange={(e) => setForm({ ...form, testNote: e.target.value })} placeholder="跑了哪些測試？結果如何？" />
      </Field>
      <Field label="未完成項目（一行一項）" htmlFor="dl-unfinished">
        <Textarea id="dl-unfinished" rows={2} value={form.unfinished} onChange={(e) => setForm({ ...form, unfinished: e.target.value })} />
      </Field>
      <Field label="需要審查者確認的問題（一行一項）" htmlFor="dl-questions">
        <Textarea id="dl-questions" rows={2} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} />
      </Field>
      {warnings.length > 0 && (
        <Callout tone="warning" title="送出前提醒（仍可送出，審查者會看到這些項目）">
          <ul className="list-disc space-y-0.5 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Callout>
      )}
      <div className="flex justify-end">
        <Button variant="primary" loading={submitReview.isPending} disabled={!form.prUrl.trim()} onClick={() => submitReview.mutate({ id: task.id, delivery: form })}>
          <GitPullRequest className="h-4 w-4" strokeWidth={1.75} />
          提交交付並送審
        </Button>
      </div>
    </Card>
  );
}

function Lines({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{label}</div>
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-800">
        {items.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

/** 已提交的交付內容 */
function DeliverySummary({ task }: { task: Task }) {
  const d = task.delivery;
  if (!d) return null;
  const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <Card className="space-y-3 p-5">
      <CardHeader title="已提交的交付" description={`提交於 ${relativeTime(d.submittedAt)}`} className="mb-0" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <ExternalLink className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
        <span className="break-all font-mono text-xs text-gray-700">{d.prUrl}</span>
        <Badge>mock</Badge>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-gray-500">交付物</div>
        <ul className="space-y-1 text-sm">
          {d.deliverables.map((x) => (
            <li key={x.text} className="flex items-center gap-2">
              <Badge tone={x.provided ? 'sky' : 'orange'}>{x.provided ? '已提供' : '未提供'}</Badge>
              {x.text}
            </li>
          ))}
        </ul>
      </div>
      {d.testNote && <Lines label="測試結果說明" items={[d.testNote]} />}
      <Lines label="未完成項目" items={lines(d.unfinished)} />
      <Lines label="待確認問題" items={lines(d.questions)} />
    </Card>
  );
}

function VerdictBadge({ v }: { v: AcVerdict }) {
  return (
    <Badge tone={AC_VERDICT[v].tone} dot>
      {AC_VERDICT[v].label}
    </Badge>
  );
}

/** G5（Reviewer 端）：AI 逐條整理驗收證據，Reviewer 可調整判斷與補充備註 */
function AcceptanceCheckCard({ task, check, editable }: { task: Task; check: AcceptanceCheck; editable: boolean }) {
  const drafts = useUiStore((s) => s.reviewDrafts[task.id]);
  const setDraft = useUiStore((s) => s.setReviewDraft);
  const items = check.items.map((_, i) => drafts?.[i] ?? { reviewer: null, note: '' });
  const patch = (i: number, p: Partial<{ reviewer: AcVerdict | null; note: string }>) =>
    setDraft(task.id, items.map((it, k) => (k === i ? { ...it, ...p } : it)));
  const test = TEST_STATUS[check.tests];

  return (
    <Card className="space-y-4 p-5">
      <CardHeader
        title="AI 驗收檢查"
        description={`${check.summary} · AI 只提供建議，由 Reviewer 決定是否驗收`}
        className="mb-0"
        action={
          <Badge tone="violet">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
            AI 建議
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">交付物</div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Badge tone={check.deliverablesComplete ? 'sky' : 'orange'} dot>
              {check.deliverablesComplete ? '齊全' : '不齊全'}
            </Badge>
            {check.missingDeliverables.length > 0 && <span className="text-gray-600">缺：{check.missingDeliverables.join('、')}</span>}
          </div>
        </div>
        <div className="rounded-2xl bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">測試結果</div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Badge tone={test.tone} dot>
              {test.label}
            </Badge>
            <span className="text-gray-600">{check.testSummary}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {check.goalMatch.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-20 shrink-0 text-xs font-medium text-gray-500">{g.label}</span>
            <VerdictBadge v={g.verdict} />
            <span className="text-gray-700">{g.detail}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-gray-500">
            <tr>
              <th className="pb-2 pr-3 font-medium">驗收條件</th>
              <th className="pb-2 pr-3 font-medium">AI 判斷與證據</th>
              <th className="pb-2 font-medium">Reviewer 判斷</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {check.items.map((it, i) => (
              <tr key={it.ac}>
                <td className="py-3 pr-3 text-gray-800">
                  <span className="mr-1.5 text-xs tabular-nums text-gray-500">{i + 1}.</span>
                  {it.ac}
                </td>
                <td className="py-3 pr-3">
                  <VerdictBadge v={it.ai} />
                  <p className="mt-1 text-xs text-gray-600">{it.evidence}</p>
                </td>
                <td className="py-3">
                  {editable ? (
                    <div className="space-y-1.5">
                      <Select
                        aria-label={`第 ${i + 1} 條的判斷`}
                        value={items[i]?.reviewer ?? ''}
                        onChange={(e) => patch(i, { reviewer: (e.target.value || null) as AcVerdict | null })}
                      >
                        <option value="">沿用 AI 判斷</option>
                        {(Object.keys(AC_VERDICT) as AcVerdict[]).map((v) => (
                          <option key={v} value={v}>
                            {AC_VERDICT[v].label}
                          </option>
                        ))}
                      </Select>
                      <Input aria-label={`第 ${i + 1} 條的備註`} value={items[i]?.note ?? ''} onChange={(e) => patch(i, { note: e.target.value })} placeholder="補充備註" />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Lines label="變更檔案（mock）" items={check.changedFiles} />
      <Lines label="未完成項目" items={check.unfinished} />
      <Lines label="需要確認的問題" items={check.questions} />
      {editable && <Callout>在上方調整判斷後，用下方「核准」或「要求修改」送出，系統會把逐條判斷與證據存成驗收紀錄。</Callout>}
    </Card>
  );
}

/** 驗收紀錄：每次核准或要求修改都保留逐條判斷與證據 */
function RecordsCard({ task, memberMap }: { task: Task; memberMap: Map<string, Member> }) {
  const { data: records = [] } = useAcceptanceRecords(task.id);
  if (!records.length) return null;
  return (
    <Card className="space-y-3 p-5">
      <CardHeader title="驗收紀錄" description="決策與對應證據" className="mb-0" />
      {records.map((r) => (
        <div key={r.id} className="rounded-2xl border border-gray-100 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={r.decision === 'approved' ? 'sky' : 'orange'} dot>
              {r.decision === 'approved' ? '核准' : '要求修改'}
            </Badge>
            <span>{mention(memberMap.get(r.reviewerId)?.name)}</span>
            <span className="text-xs text-gray-500">{relativeTime(r.at)}</span>
          </div>
          {r.reason && <p className="mt-1 text-sm text-gray-700">{r.reason}</p>}
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {r.items.map((it, i) => (
              <li key={it.ac} className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-gray-500">{i + 1}.</span>
                <VerdictBadge v={it.reviewer ?? it.ai} />
                <span className="text-gray-800">{it.ac}</span>
                <span>· {it.evidence}</span>
                {it.note && <span className="text-gray-800">· 備註：{it.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  );
}

/** G5：交付與驗收分頁（成員提交、AI 檢查、Reviewer 驗收與紀錄） */
export function DeliveryTab({ task, me, memberMap }: Props) {
  const owner = task.assigneeId === me.id;
  const reviewing = task.state === 'IN_REVIEW' || task.state === 'DONE';
  const { data: check, isLoading } = useAcceptanceCheck(task.id, reviewing && !!task.pr);
  const editable = canReview(task, me.id);

  return (
    <div className="space-y-6">
      {task.state === 'IN_PROGRESS' && owner && <DeliveryForm task={task} />}
      {task.state === 'IN_PROGRESS' && !owner && (
        <Card>
          <EmptyState icon={GitPullRequest} title="開發中" description="負責人提交交付並送審後，這裡會顯示交付內容與 AI 驗收檢查。" />
        </Card>
      )}
      {!reviewing && task.state !== 'IN_PROGRESS' && (
        <Card>
          <EmptyState icon={GitPullRequest} title="還沒有交付內容" description="開始開發並送審後，這裡會顯示交付與驗收。" />
        </Card>
      )}
      {task.state === 'IN_PROGRESS' && task.delivery && !owner && <DeliverySummary task={task} />}
      {reviewing && <DeliverySummary task={task} />}
      {reviewing &&
        task.pr &&
        (isLoading || !check ? (
          <Card className="space-y-3 p-5">
            <p className="text-sm text-gray-500">AI 正在比對 PR 與任務目標、範圍和驗收條件…</p>
            <Skeleton className="h-24" />
          </Card>
        ) : (
          <AcceptanceCheckCard task={task} check={check} editable={editable} />
        ))}
      <RecordsCard task={task} memberMap={memberMap} />
    </div>
  );
}
