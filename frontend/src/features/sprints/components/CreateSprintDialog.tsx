import { Sparkles, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Button, Field, Input, Label, Modal, Tag, Textarea } from '@/components/ui';
import { useMembers } from '@/hooks/queries';
import { sum } from '@/lib/format';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { SprintDoc } from '@/types';
import { useSprintDefaults, useSprintMutations } from '../hooks/useSprintMutations';

const formatSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/** 建立 Sprint：名稱、起訖日期、Sprint Goal、本次 Capacity（直接估點）、會議紀錄與文件資料 */
export function CreateSprintDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: members = [] } = useMembers();
  const { data: defaults } = useSprintDefaults(open);
  const { createSprint } = useSprintMutations();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [capacity, setCapacity] = useState<Record<string, number>>({});
  const [minutes, setMinutes] = useState('');
  const [docs, setDocs] = useState<SprintDoc[]>([]);
  const notesRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !defaults) return;
    setName(defaults.name);
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setGoal('');
    setCapacity(defaults.capacity);
    setMinutes(defaults.minutes);
    setDocs([]);
  }, [open, defaults]);

  const carryCount = (minutes.match(/^- \[(延續|延後|跨 Sprint)\]/gm) ?? []).length;
  const loadSample = async () => {
    const sample = await api.planning.getSampleMinutes();
    setMinutes(defaults?.minutes ? `${sample}\n\n${defaults.minutes}` : sample);
  };

  const submit = () =>
    createSprint.mutate({ name, startDate, endDate, goal, capacity, minutes, docs }, { onSuccess: onClose });

  return (
    <Modal open={open} onClose={onClose} title="建立 Sprint" description="建立後會直接進入 Planning Studio。" className="max-w-3xl">
      {!defaults ? (
        <p className="py-8 text-center text-sm text-gray-500">載入中…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
            <Field label="名稱" htmlFor="ns-name">
              <Input id="ns-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="開始日期" htmlFor="ns-start">
              <Input id="ns-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="結束日期" htmlFor="ns-end">
              <Input id="ns-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Sprint Goal（可以先空著，讓 AI 從會議紀錄擷取）" htmlFor="ns-goal">
            <Input id="ns-goal" value={goal} placeholder="本次 Sprint 要達成的成果" onChange={(e) => setGoal(e.target.value)} />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="mb-0">本次 Capacity：直接預估每人可分配的點數</Label>
              <span className="text-sm">
                總計 <b className="tabular-nums">{sum(Object.values(capacity))}</b> SP
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2">
                  <Avatar member={m} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.name}
                    <span className="text-xs text-gray-500"> · {m.title}</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    aria-label={`${m.name} 本次點數`}
                    className="h-9 w-16 px-2"
                    value={capacity[m.id] ?? m.capacity}
                    onChange={(e) => setCapacity({ ...capacity, [m.id]: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="text-xs text-gray-500">SP</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500">不需匯入課表或行事曆；請依成員本次可投入的時間直接估點。</p>
          </div>

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="ns-minutes" className="mb-0">
                本次會議紀錄
              </Label>
              <div className="flex gap-1.5">
                <Button size="xs" onClick={() => notesRef.current?.click()}>
                  <Upload className="h-3 w-3" strokeWidth={1.75} />
                  上傳 .md / .txt
                </Button>
                <Button size="xs" onClick={loadSample}>
                  帶入範例會議紀錄
                </Button>
              </div>
              <input
                ref={notesRef}
                type="file"
                accept=".md,.txt"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = String(reader.result ?? '');
                    setMinutes(defaults.minutes ? `${text}\n\n${defaults.minutes}` : text);
                    toast(`已讀取 ${file.name}`);
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </div>
            <Textarea
              id="ns-minutes"
              rows={11}
              className="bg-gray-50 font-mono text-xs"
              placeholder="貼上本次會議紀錄（逐字稿或整理好的文件皆可）"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            {carryCount > 0 && (
              <p className="mt-1.5 text-xs text-amber-700">已自動帶入 {carryCount} 項延續事項（上個 Sprint 未完成、延後、跨 Sprint 的問題）</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="mb-0">本次文件資料</Label>
              <Button size="xs" onClick={() => docsRef.current?.click()}>
                <Upload className="h-3 w-3" strokeWidth={1.75} />
                上傳文件
              </Button>
              <input
                ref={docsRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])];
                  setDocs([...docs, ...files.map((f) => ({ name: f.name, size: formatSize(f.size) }))]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {docs.length ? (
                docs.map((d, i) => (
                  <Tag key={`${d.name}-${i}`}>
                    {d.name}
                    <button type="button" aria-label={`移除 ${d.name}`} onClick={() => setDocs(docs.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </Tag>
                ))
              ) : (
                <span className="text-xs text-gray-400">例如：本次需求補充、設計稿說明、API 變更（會與專案知識庫一起提供給 AI）</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>取消</Button>
            <Button variant="primary" loading={createSprint.isPending} onClick={submit}>
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              建立並進入 Planning Studio
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
