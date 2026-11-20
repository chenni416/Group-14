import { ArrowRight, Sparkles, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Label, Modal, Tag, Textarea } from '@/components/ui';
import { useSprintDefaults, useSprintMutations } from '@/features/sprints/hooks/useSprintMutations';
import { useDocs, useMembers, useSprintContext } from '@/hooks/queries';
import { sum } from '@/lib/format';
import { CARRY_HEADER, carryLoad, carrySP } from '@/lib/planning';
import { ragStatus } from '@/lib/rag';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { NewSprintDefaults, Sprint, SprintDoc } from '@/types';
import { usePlanningMutations } from '../hooks/usePlanning';
import { usePlanningStore } from '../store';
import { AnalyzeProgress } from './AnalyzeProgress';

interface SetupForm {
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  capacity: Record<string, number>;
  minutes: string;
  docs: SprintDoc[];
}

const CARRY_LINE = /^- \[(延續|延後|跨 Sprint)\]/gm;

const fromSprint = (s: Sprint): SetupForm => ({
  name: s.name,
  startDate: s.startDate,
  endDate: s.endDate,
  goal: s.goal,
  capacity: { ...s.capacity },
  minutes: s.minutes,
  docs: [...s.docs],
});

const fromDefaults = (d: NewSprintDefaults): SetupForm => ({
  name: d.name,
  startDate: d.startDate,
  endDate: d.endDate,
  goal: '',
  capacity: { ...d.capacity },
  minutes: d.minutes,
  docs: [],
});

/** 比對用：capacity 依成員排序，避免鍵順序不同被誤判為修改 */
const snapshot = (f: SetupForm) =>
  JSON.stringify({ ...f, capacity: Object.entries(f.capacity).sort(([a], [b]) => a.localeCompare(b)) });

/** 換上新的會議紀錄時，保留系統自動帶入的延續事項區塊 */
const withCarry = (text: string, current: string) => {
  const idx = current.indexOf(CARRY_HEADER);
  return idx >= 0 ? `${text.trimEnd()}\n\n${current.slice(idx)}` : text;
};

const formatSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

function basicProblem(f: SetupForm) {
  if (!f.name.trim()) return '請輸入 Sprint 名稱';
  if (!f.startDate || !f.endDate || f.endDate < f.startDate) return '請確認起訖日期';
  return null;
}

/**
 * 階段 0「開啟 Sprint 與設定」。
 * - 新建模式（沒有規劃中的 Sprint）：按下「開始 AI 分析」才建立 Sprint；中途離開會詢問是否暫存（暫存＝建立規劃中的 Sprint）。
 * - 編輯模式：修改規劃中 Sprint 的設定；有未儲存修改時離開或切換階段會詢問是否儲存。
 */
export function SprintSetup({ sprint }: { sprint: Sprint | undefined }) {
  const isNew = !sprint;
  const { data: members = [] } = useMembers();
  const { data: knowledge } = useDocs();
  const { carryTasks } = useSprintContext();
  const { data: defaults } = useSprintDefaults(isNew);
  const { createSprint } = useSprintMutations();
  const { generate, updateSprint } = usePlanningMutations();
  const { draft, pendingStage, setStage, requestStage, clearPendingStage, setSetupDirty } = usePlanningStore();

  const [form, setForm] = useState<SetupForm | null>(null);
  const [baseline, setBaseline] = useState<SetupForm | null>(null);
  const initKey = useRef<string | null>(null);
  const notesRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  // 只在切換模式或換了 Sprint 時初始化，背景重新抓取不會覆蓋正在編輯的內容
  const source = useMemo(() => (sprint ? fromSprint(sprint) : defaults ? fromDefaults(defaults) : null), [sprint, defaults]);
  const key = sprint ? `sprint-${sprint.id}` : 'new';
  useEffect(() => {
    if (!source || initKey.current === key) return;
    initKey.current = key;
    setForm(source);
    setBaseline(source);
  }, [key, source]);

  const dirty = !!form && !!baseline && snapshot(form) !== snapshot(baseline);
  const saving = createSprint.isPending || updateSprint.isPending;
  const analyzing = generate.isPending;

  useEffect(() => setSetupDirty(dirty), [dirty, setSetupDirty]);
  useEffect(() => () => setSetupDirty(false), [setSetupDirty]);

  // 關閉分頁或重新整理：只能顯示瀏覽器內建提示
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !saving && !analyzing && currentLocation.pathname !== nextLocation.pathname,
  );
  const leaveOpen = blocker.state === 'blocked' || pendingStage != null;

  if (!form) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-gray-500">載入中…</p>
      </Card>
    );
  }

  const patch = (p: Partial<SetupForm>) => setForm({ ...form, ...p });
  const totalCap = sum(members.map((m) => form.capacity[m.id] ?? m.capacity));
  const carryCount = (form.minutes.match(CARRY_LINE) ?? []).length;
  const carried = carryTasks.filter((t) => t.carry === true);
  const carriedLoad = carryLoad(members, carryTasks);
  const rag = ragStatus(knowledge ?? []);

  /** 寫入目前的設定：新建模式建立 Sprint，編輯模式更新 Sprint。成功回傳 true */
  const persist = async () => {
    const problem = basicProblem(form);
    if (problem) {
      toast(problem);
      return false;
    }
    try {
      if (sprint) {
        await updateSprint.mutateAsync({ id: sprint.id, patch: form });
      } else {
        const capacity = Object.fromEntries(members.map((m) => [m.id, form.capacity[m.id] ?? m.capacity]));
        await createSprint.mutateAsync({ ...form, capacity });
      }
      setBaseline(form);
      return true;
    } catch {
      return false; // 錯誤訊息已由 useApiMutation 顯示
    }
  };

  const runAnalyze = async () => {
    if (!form.minutes.trim()) {
      toast('請先貼上會議紀錄');
      return;
    }
    if ((isNew || dirty) && !(await persist())) return;
    if (isNew) toast(`已建立 ${form.name.trim()}，AI 開始分析會議紀錄`);
    generate.mutate({ goal: form.goal, minutes: form.minutes });
  };

  /* ---- 離開確認 ---- */
  const stay = () => {
    if (blocker.state === 'blocked') blocker.reset();
    clearPendingStage();
  };
  const leave = () => {
    if (blocker.state === 'blocked') blocker.proceed();
    if (pendingStage) setStage(pendingStage);
    clearPendingStage();
  };
  const discardAndLeave = () => {
    setForm(baseline);
    leave();
  };
  const saveAndLeave = async () => {
    if (!(await persist())) return;
    toast(isNew ? `已暫存 ${form.name.trim()}，回到 Sprint 規劃即可繼續編輯` : '已儲存 Sprint 設定');
    leave();
  };

  const readNotes = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patch({ minutes: withCarry(String(reader.result ?? ''), form.minutes) });
      toast(`已讀取 ${file.name}`);
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="基本資訊"
              description={isNew ? '已帶入建議的名稱與日期。按下「開始 AI 分析」時才會建立 Sprint。' : undefined}
            />
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr]">
                <Field label="名稱" htmlFor="setup-name">
                  <Input id="setup-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} />
                </Field>
                <Field label="開始日期" htmlFor="setup-start">
                  <Input id="setup-start" type="date" value={form.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
                </Field>
                <Field label="結束日期" htmlFor="setup-end">
                  <Input id="setup-end" type="date" value={form.endDate} onChange={(e) => patch({ endDate: e.target.value })} />
                </Field>
              </div>
              <Field label="Sprint Goal（可以先空著，讓 AI 從會議紀錄擷取）" htmlFor="setup-goal">
                <Input id="setup-goal" value={form.goal} placeholder="本次 Sprint 要達成的成果" onChange={(e) => patch({ goal: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="本次 Capacity"
              description={`依成員本次可投入的時間直接估點，不需匯入課表或行事曆。${carried.length ? '上輪帶入的任務會佔用其中的點數。' : ''}`}
              action={
                <span className="text-sm">
                  總計 <b className="tabular-nums">{totalCap}</b> SP
                </span>
              }
            />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-2xl border border-gray-100 px-3 py-2">
                  <Avatar member={m} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {m.name}
                    <span className="text-xs text-gray-500">
                      {' '}
                      · {carriedLoad[m.id] ? `帶入 ${carriedLoad[m.id]} SP` : m.title}
                    </span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    aria-label={`${m.name} 本次點數`}
                    className="h-9 w-16 px-2"
                    value={form.capacity[m.id] ?? m.capacity}
                    onChange={(e) => patch({ capacity: { ...form.capacity, [m.id]: Math.max(0, Number(e.target.value) || 0) } })}
                  />
                  <span className="text-xs text-gray-500">SP</span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="會議紀錄"
              description="逐字稿或整理好的文件皆可（Markdown）。"
              action={
                <>
                  <Button size="xs" onClick={() => notesRef.current?.click()}>
                    <Upload className="h-3 w-3" strokeWidth={1.75} />
                    上傳
                  </Button>
                  <Button
                    size="xs"
                    onClick={async () => patch({ minutes: withCarry(await api.planning.getSampleMinutes(), form.minutes) })}
                  >
                    範例
                  </Button>
                  <input
                    ref={notesRef}
                    type="file"
                    accept=".md,.txt"
                    hidden
                    onChange={(e) => {
                      readNotes(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </>
              }
            />
            <Textarea
              id="setup-minutes"
              aria-label="會議紀錄"
              rows={14}
              className="bg-gray-50 font-mono text-xs"
              placeholder="貼上本次會議紀錄"
              value={form.minutes}
              onChange={(e) => patch({ minutes: e.target.value })}
            />
            {carryCount > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                已帶入 {carryCount} 項延續事項（在「上輪 Sprint 統整」選擇納入本輪的項目）。帶入的未完成任務會直接延續，不寫進會議紀錄。
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="本次文件"
              description="需求補充、設計稿說明、API 變更等，會與專案知識庫一起提供給 AI。"
              action={
                <>
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
                      patch({ docs: [...form.docs, ...files.map((f) => ({ name: f.name, size: formatSize(f.size) }))] });
                      e.target.value = '';
                    }}
                  />
                </>
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {form.docs.length ? (
                form.docs.map((d, i) => (
                  <Tag key={`${d.name}-${i}`}>
                    {d.name}
                    <span className="text-gray-400">{d.size}</span>
                    <button type="button" aria-label={`移除 ${d.name}`} onClick={() => patch({ docs: form.docs.filter((_, j) => j !== i) })}>
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </Tag>
                ))
              ) : (
                <span className="text-xs text-gray-400">尚未上傳文件</span>
              )}
            </div>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-0">
          {analyzing ? (
            <AnalyzeProgress docCount={knowledge?.length ?? 0} />
          ) : (
            <>
              <CardHeader title={form.name.trim() || '新 Sprint'} description={isNew ? '尚未建立' : dirty ? '有未儲存的修改' : '設定已儲存'} />
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">期間</dt>
                  <dd className="tabular-nums">
                    {form.startDate || '—'} – {form.endDate || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">總 Capacity</dt>
                  <dd className="tabular-nums">{totalCap} SP</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">上輪帶入</dt>
                  <dd className="tabular-nums">
                    {carried.length} 項 · {sum(carried.map(carrySP))} SP
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">延續事項</dt>
                  <dd className="tabular-nums">{carryCount} 項</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">本次文件</dt>
                  <dd className="tabular-nums">{form.docs.length} 份</dd>
                </div>
              </dl>
              <div className="mt-5">
                <Label>AI 已掛載的專案脈絡</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone={rag.ready ? 'sky' : 'orange'} dot>
                    {rag.label}
                  </Badge>
                  {knowledge?.slice(0, 5).map((d) => <Tag key={d.id}>{d.kind}</Tag>)}
                </div>
              </div>
            </>
          )}

          <div className="mt-6 space-y-2">
            <Button variant="primary" size="lg" className="w-full" loading={analyzing || saving} disabled={!form.minutes.trim()} onClick={runAnalyze}>
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              {analyzing ? 'AI 分析中' : draft ? '重新分析（覆蓋目前草稿）' : '開始 AI 分析'}
            </Button>
            {!isNew && dirty && !analyzing && (
              <Button className="w-full" loading={updateSprint.isPending} onClick={async () => (await persist()) && toast('已儲存 Sprint 設定')}>
                儲存設定
              </Button>
            )}
            {draft && !analyzing && (
              <Button className="w-full" onClick={() => requestStage('stories')}>
                回到審核工作區
                <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            )}
          </div>
          {draft && !analyzing && (
            <p className="mt-3 text-xs text-gray-500">
              目前草稿：{draft.stories.length} 個 Story、{draft.tasks.length ? `${draft.tasks.length} 張 Task` : '尚未拆解 Task'}
            </p>
          )}
        </Card>
      </div>

      <Modal
        open={leaveOpen}
        onClose={stay}
        title={isNew ? '要暫存這個 Sprint 嗎？' : '要儲存 Sprint 設定的修改嗎？'}
        className="max-w-md"
      >
        <p className="text-sm leading-relaxed text-gray-600">
          {isNew
            ? `暫存會建立規劃中的「${form.name.trim() || '新 Sprint'}」，之後回到 Sprint 規劃可以繼續編輯；不暫存則捨棄目前填寫的內容。`
            : '離開前可以先儲存修改；不儲存則恢復為上次儲存的設定。'}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={stay}>繼續編輯</Button>
          <Button onClick={discardAndLeave}>{isNew ? '不暫存，離開' : '捨棄修改'}</Button>
          <Button variant="primary" loading={saving} onClick={saveAndLeave}>
            {isNew ? '暫存並建立 Sprint' : '儲存修改'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
