import { FileText, LoaderCircle, Plus, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Badge, Button, Callout, Card, CardHeader, Input, Label, SegmentedControl, Tag, Textarea } from '@/components/ui';
import { useDocs, useMembers } from '@/hooks/queries';
import { cn } from '@/lib/cn';
import { capOf, capTotal, isBullet, lineMatchesSource, stripBullet, stripCarryNote } from '@/lib/planning';
import { ragStatus } from '@/lib/rag';
import { toast } from '@/stores/toast.store';
import type { PlanningStep, Sprint } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { ClarifyQuestions } from './ClarifyQuestions';

export type NotesMode = 'edit' | 'view';

interface Props {
  sprint: Sprint;
  isLead: boolean;
  step: PlanningStep;
  mode: NotesMode;
  onModeChange: (mode: NotesMode) => void;
  /** 目前要標示的來源句 */
  highlight: string | null;
  /** 以會議紀錄中的一句建立任務 */
  onAddFromLine: (text: string) => void;
  /** 讓「＋ 新增任務」取得目前反白的文字 */
  selectionRef: MutableRefObject<() => string>;
  onDecomposed: () => void;
}

const readText = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });

/** 左側：Sprint Goal、會議紀錄（編輯 / 對照來源句）、本次文件、待釐清問題 */
export function SourceContext({ sprint, isLead, step, mode, onModeChange, highlight, onAddFromLine, selectionRef, onDecomposed }: Props) {
  const { data: docs } = useDocs();
  const { data: members = [] } = useMembers();
  const { updateSprint, addDocs, analyze, decompose } = usePlanningMutations();
  const [minutes, setMinutes] = useState(sprint.minutes);
  const [goal, setGoal] = useState(sprint.goal);
  const minutesRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMinutes(sprint.minutes), [sprint.minutes]);
  useEffect(() => setGoal(sprint.goal), [sprint.goal]);

  // 「＋ 新增任務」會讀取這裡反白的文字作為來源句
  useEffect(() => {
    selectionRef.current = () => {
      const ta = textRef.current;
      if (ta && ta.selectionEnd > ta.selectionStart) return ta.value.slice(ta.selectionStart, ta.selectionEnd);
      const sel = window.getSelection();
      return sel && viewRef.current && sel.anchorNode && viewRef.current.contains(sel.anchorNode) ? sel.toString() : '';
    };
  }, [selectionRef]);

  useEffect(() => {
    if (mode === 'view' && highlight) viewRef.current?.querySelector('[data-hl="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [mode, highlight]);

  const saveMinutes = () => minutes !== sprint.minutes && updateSprint.mutate({ id: sprint.id, patch: { minutes } });
  const runDecompose = () => decompose.mutate(sprint.id, { onSuccess: onDecomposed });
  const runAnalyze = () =>
    analyze.mutate(
      { id: sprint.id, minutes },
      {
        onSuccess: ({ unanswered }) => {
          if (unanswered) toast(`AI 找到 ${unanswered} 個待釐清問題，回答後才能拆解`);
          else runDecompose();
        },
      },
    );

  const rag = ragStatus(docs ?? []);
  const questions = sprint.questions;
  const unanswered = questions?.filter((q) => !q.answer).length ?? 0;
  const busy = analyze.isPending || decompose.isPending;

  let action;
  if (!isLead) action = <Callout tone="warning">只有 Leader / PO 可以分析、拆解與核准，請從右上角切換身分。</Callout>;
  else if (busy)
    action = (
      <Button variant="primary" size="lg" className="w-full" disabled>
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} />
        {analyze.isPending ? 'AI 分析會議紀錄中…' : 'AI 拆解中…'}
      </Button>
    );
  else if (!questions)
    action = (
      <Button variant="primary" size="lg" className="w-full" disabled={!minutes.trim()} onClick={runAnalyze}>
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        AI 分析會議紀錄
      </Button>
    );
  else if (unanswered)
    action = (
      <Button variant="primary" size="lg" className="w-full" disabled>
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        回答完成後才能拆解（尚有 {unanswered} 題）
      </Button>
    );
  else if (step < 3)
    action = (
      <Button variant="primary" size="lg" className="w-full" onClick={runDecompose}>
        <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        回答完成，開始 AI 拆解
      </Button>
    );
  else
    action = (
      <Button size="lg" className="w-full" onClick={runAnalyze}>
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
        重新拆解（保留已調整的任務）
      </Button>
    );

  const lines = minutes.split('\n');

  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader title="Source Context" action={<Tag>{`${sprint.start} – ${sprint.end}`}</Tag>} />
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          <Tag className="border-gray-900 text-gray-900">Capacity {capTotal(sprint, members)} SP</Tag>
          {members.map((m) => (
            <Tag key={m.id}>
              {m.name} {capOf(sprint, m)}
            </Tag>
          ))}
        </div>

        <div>
          <Label htmlFor="sprint-goal">Sprint Goal</Label>
          <Input
            id="sprint-goal"
            value={goal}
            disabled={!isLead}
            placeholder="可留空，AI 會從會議紀錄擷取"
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => goal !== sprint.goal && updateSprint.mutate({ id: sprint.id, patch: { goal } })}
          />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl<NotesMode>
              size="sm"
              aria-label="會議紀錄檢視方式"
              value={mode}
              onChange={(m) => {
                saveMinutes();
                onModeChange(m);
              }}
              options={[
                { value: 'edit', label: '編輯會議紀錄' },
                { value: 'view', label: '對照來源句' },
              ]}
            />
            {mode === 'edit' && isLead && (
              <Button size="xs" onClick={() => minutesRef.current?.click()}>
                <Upload className="h-3 w-3" strokeWidth={1.75} />
                上傳
              </Button>
            )}
            <input
              ref={minutesRef}
              type="file"
              accept=".md,.txt"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await readText(file);
                setMinutes(text);
                updateSprint.mutate({ id: sprint.id, patch: { minutes: text } });
                toast(`已讀取 ${file.name}`);
                e.target.value = '';
              }}
            />
          </div>
          {mode === 'edit' ? (
            <Textarea
              ref={textRef}
              id="minutes"
              aria-label="會議紀錄"
              rows={15}
              value={minutes}
              disabled={!isLead}
              placeholder="貼上本次會議紀錄（逐字稿或整理好的文件皆可）"
              onChange={(e) => setMinutes(e.target.value)}
              onBlur={saveMinutes}
              className="bg-gray-50 font-mono text-xs"
            />
          ) : (
            <>
              <div ref={viewRef} className="max-h-[440px] overflow-auto rounded-xl border border-gray-200 bg-white py-2 font-mono text-xs leading-relaxed">
                {lines.map((l, i) => {
                  const hit = lineMatchesSource(l, highlight);
                  return (
                    <div
                      key={i}
                      data-hl={hit}
                      className={cn(
                        'group flex items-start gap-2 px-3 py-0.5',
                        hit && 'bg-amber-100 shadow-[inset_3px_0_0_#f59e0b]',
                        /^#/.test(l) && 'font-semibold',
                        /\[(延續|延後|跨 Sprint)\]/.test(l) && 'text-amber-800',
                      )}
                    >
                      <span className="w-5 shrink-0 select-none text-right text-gray-400">{i + 1}</span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{l || ' '}</span>
                      {isLead && isBullet(l) && (
                        <button
                          type="button"
                          aria-label={`以第 ${i + 1} 行建立任務`}
                          title="以這句建立任務"
                          onClick={() => onAddFromLine(stripCarryNote(stripBullet(l)))}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 opacity-0 transition-opacity hover:bg-gray-50 focus:opacity-100 group-hover:opacity-100"
                        >
                          <Plus className="h-3 w-3" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">點任務卡的「來源句」會在這裡標示；反白文字後按「＋ 新增任務」，或點句子旁的 ＋，即可截取為任務來源。</p>
            </>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">本次文件資料</Label>
            {isLead && (
              <Button size="xs" loading={addDocs.isPending} onClick={() => docsRef.current?.click()}>
                <Upload className="h-3 w-3" strokeWidth={1.75} />
                上傳
              </Button>
            )}
            <input
              ref={docsRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                if (files.length) addDocs.mutate({ id: sprint.id, files });
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sprint.docs.length ? (
              sprint.docs.map((d, i) => (
                <Tag key={`${d.name}-${i}`}>
                  <FileText className="h-3 w-3" strokeWidth={1.75} />
                  {d.name}
                </Tag>
              ))
            ) : (
              <span className="text-xs text-gray-400">尚無本次文件</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={rag.ready ? 'sky' : 'orange'} dot>
              專案知識庫 · {rag.label}
            </Badge>
          </div>
        </div>

        <ClarifyQuestions sprint={sprint} isLead={isLead} />
        {action}
      </div>
    </Card>
  );
}
