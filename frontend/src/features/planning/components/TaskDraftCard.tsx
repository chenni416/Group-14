import { ChevronDown, GripVertical, Plus, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, IconButton, Input, Label, SegmentedControl, Select, Tag } from '@/components/ui';
import { DOMAINS, STORY_POINT_OPTIONS } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { REVIEWER_LABELS, suggestAssignee, toSlug } from '@/lib/planning';
import { BRANCH_PREFIXES, type BranchPrefix, type Member, type ReviewerMode, type TaskDraft } from '@/types';
import { usePlanningStore } from '../store';
import { DependencyChips } from './DependencyChips';
import { DependencyEditor } from './DependencyEditor';
import { TASK_DRAG_TYPE } from './TeamCapacityBar';

interface Props {
  task: TaskDraft;
  branch: string;
  members: Member[];
  load: Record<string, number>;
  selected: boolean;
  /** 收合時只顯示單行摘要 */
  collapsed: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onChange: (patch: Partial<TaskDraft>) => void;
  /** 指派負責人（null 為取消指派），走統一的自動收合規則 */
  onAssign: (memberId: string | null) => void;
  onRemove: () => void;
}

function DragHandle({ taskId, className }: { taskId: string; className?: string }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={(e) => e.stopPropagation()}
      title="拖曳到上方成員欄位即可指派"
      aria-label="拖曳以指派"
      className={cn(
        'cursor-grab rounded-md p-0.5 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing',
        className,
      )}
    >
      <GripVertical className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

function ToggleButton({ code, collapsed, onToggle }: { code: string; collapsed: boolean; onToggle: () => void }) {
  return (
    <IconButton
      aria-label={`${collapsed ? '展開' : '收合'} ${code}`}
      aria-expanded={!collapsed}
      size="sm"
      variant="ghost"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <ChevronDown className={cn('h-4 w-4', !collapsed && 'rotate-180')} strokeWidth={1.75} />
    </IconButton>
  );
}

function AssigneePill({ name }: { name: string | undefined }) {
  return name ? (
    <Badge tone="sky" dot>
      已指派：{name}
    </Badge>
  ) : (
    <Badge tone="orange" dot>
      未指派
    </Badge>
  );
}

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <Label>{label}</Label>
    {children}
  </div>
);

export function TaskDraftCard({
  task,
  branch,
  members,
  load,
  selected,
  collapsed,
  onToggle,
  onSelect,
  onChange,
  onAssign,
  onRemove,
}: Props) {
  const assigneeName = members.find((m) => m.id === task.assigneeId)?.name;
  const requestRestore = usePlanningStore((s) => s.requestRestore);

  const shell = cn(
    'rounded-2xl border bg-white transition-colors duration-150',
    selected ? 'border-neutral-900' : 'border-gray-100 hover:border-gray-300',
  );

  // 已延後：留在原位以虛線與灰字標註，不計負載；可直接取消延後
  if (task.deferred) {
    return (
      <article
        data-task-id={task.id}
        onClick={onSelect}
        className={cn(
          'flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1.5 rounded-2xl border border-dashed bg-gray-50/70 px-4 py-3',
          selected ? 'border-neutral-900' : 'border-gray-300',
        )}
      >
        <span className="shrink-0 font-mono text-xs text-gray-500">{task.code}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-gray-500">{task.title}</span>
        <span className="shrink-0 text-xs tabular-nums text-gray-400 line-through">{task.storyPoints} SP</span>
        <Badge>已延後 · 本輪不處理</Badge>
        <DependencyChips itemId={task.id} size="xs" className="w-full sm:w-auto" />
        <Button
          size="xs"
          aria-label={`取消延後 ${task.code}`}
          onClick={(e) => {
            e.stopPropagation();
            requestRestore('task', task.id);
          }}
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          取消延後
        </Button>
      </article>
    );
  }

  // 收合：單行摘要（編號、標題、點數、指派狀態），點擊整列即可展開
  if (collapsed) {
    return (
      <article
        data-task-id={task.id}
        onClick={() => {
          onSelect();
          onToggle();
        }}
        className={cn(shell, 'flex cursor-pointer items-center gap-2 px-4 py-3')}
      >
        <DragHandle taskId={task.id} />
        <span className="shrink-0 font-mono text-xs text-gray-500">{task.code}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{task.title}</span>
        <span className="shrink-0 text-xs font-medium tabular-nums text-gray-700">{task.storyPoints} SP</span>
        <DependencyChips itemId={task.id} size="xs" className="hidden shrink-0 sm:flex" />
        <AssigneePill name={assigneeName} />
        <ToggleButton code={task.code} collapsed onToggle={onToggle} />
      </article>
    );
  }

  return (
    <article data-task-id={task.id} onMouseDown={onSelect} onFocusCapture={onSelect} className={cn(shell, 'p-5')}>
      {/* 1. 任務編號與標題 */}
      <div className="mb-4 flex items-start gap-2">
        <DragHandle taskId={task.id} className="mt-2" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-gray-500">{task.code}</span>
            <Tag>{DOMAINS[task.domain].label}</Tag>
            <AssigneePill name={assigneeName} />
            <DependencyChips itemId={task.id} />
          </div>
          <Input value={task.title} aria-label="任務標題" onChange={(e) => onChange({ title: e.target.value })} className="font-medium" />
        </div>
        <div className="flex shrink-0 items-center">
          <IconButton aria-label={`移除 ${task.code}`} size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
          <ToggleButton code={task.code} collapsed={false} onToggle={onToggle} />
        </div>
      </div>

      <TaskDraftFields
        task={task}
        branch={branch}
        members={members}
        load={load}
        onChange={onChange}
        onAssign={onAssign}
        className="pl-7"
      />
    </article>
  );
}

interface FieldsProps {
  task: TaskDraft;
  branch: string;
  members: Member[];
  load: Record<string, number>;
  onChange: (patch: Partial<TaskDraft>) => void;
  onAssign: (memberId: string | null) => void;
  /** false 時負責人選單沒有「未指派」（派工總覽只能在成員之間改派） */
  allowUnassign?: boolean;
  className?: string;
}

/** Task 的可編輯欄位（分支、點數、負責人、驗收條件、審查人員），工作區卡片與 Team Capacity 抽屜共用 */
export function TaskDraftFields({ task, branch, members, load, onChange, onAssign, allowUnassign = true, className }: FieldsProps) {
  const [newAc, setNewAc] = useState('');
  /** null：尚未詢問 */
  const [suggestion, setSuggestion] = useState<ReturnType<typeof suggestAssignee> | null>(null);
  const leaderId = members.find((m) => m.role === 'Leader')?.id;
  const addAc = () => {
    if (!newAc.trim()) return;
    onChange({ acceptanceCriteria: [...task.acceptanceCriteria, newAc.trim()] });
    setNewAc('');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 2. 分支命名 */}
      <Section label="分支命名">
        <SegmentedControl<BranchPrefix>
          size="sm"
          aria-label="分支前綴"
          value={task.branchPrefix}
          onChange={(branchPrefix) => onChange({ branchPrefix })}
          options={BRANCH_PREFIXES.map((p) => ({ value: p, label: `${p}/` }))}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3 py-2.5 font-mono text-xs text-gray-800">{branch}</code>
          <Input
            aria-label="分支摘要敘述"
            value={task.branchSlug}
            onChange={(e) => onChange({ branchSlug: toSlug(e.target.value) || '' })}
            className="font-mono text-xs sm:w-48"
            placeholder="summary-slug"
          />
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        {/* 3. 評估點數 */}
        <Section label="評估點數">
          <Select aria-label="評估點數" value={task.storyPoints} onChange={(e) => onChange({ storyPoints: Number(e.target.value) })}>
            {STORY_POINT_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v} SP
              </option>
            ))}
          </Select>
        </Section>
        {/* 5. 指派負責人 */}
        <Section label="指派負責人">
          <Select
            aria-label="指派負責人"
            value={task.assigneeId ?? ''}
            onChange={(e) => onAssign(e.target.value || null)}
          >
            {allowUnassign && <option value="">未指派</option>}
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {load[m.id] ?? 0}/{m.capacity} SP
              </option>
            ))}
          </Select>
        </Section>
      </div>

      {/* 5-1. AI 重新建議負責人 */}
      {suggestion === null ? (
        <Button size="xs" variant="ghost" className="-mt-2" onClick={() => setSuggestion(suggestAssignee(task, members, load))}>
          <Sparkles className="h-3.5 w-3.5 text-violet-600" strokeWidth={1.75} />
          AI 重新建議負責人
        </Button>
      ) : !suggestion.member ? (
        <div className="-mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2" aria-label="AI 建議負責人">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-xs text-gray-700">{suggestion.reason}</p>
          <Button size="xs" onClick={() => setSuggestion(null)}>
            知道了
          </Button>
        </div>
      ) : (
        <div className="-mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2" aria-label="AI 建議負責人">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-xs text-gray-700">
            建議改由 <span className="font-medium text-gray-900">{suggestion.member.name}</span> 處理：{suggestion.reason}
          </p>
          <Button
            size="xs"
            variant="primary"
            onClick={() => {
              if (suggestion.member) onAssign(suggestion.member.id);
              setSuggestion(null);
            }}
          >
            套用
          </Button>
          <Button size="xs" onClick={() => setSuggestion(null)}>
            略過
          </Button>
        </div>
      )}

      {/* 4. 驗收條件 */}
      <Section label="驗收條件">
        <ul className="space-y-1.5">
          {task.acceptanceCriteria.map((ac, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] tabular-nums text-gray-600">
                {i + 1}
              </span>
              <input
                value={ac}
                aria-label={`驗收條件 ${i + 1}`}
                onChange={(e) =>
                  onChange({ acceptanceCriteria: task.acceptanceCriteria.map((x, k) => (k === i ? e.target.value : x)) })
                }
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-700 transition-colors duration-150 hover:border-gray-200 focus:border-gray-900 focus:outline-none"
              />
              <button
                type="button"
                aria-label={`刪除驗收條件 ${i + 1}`}
                onClick={() => onChange({ acceptanceCriteria: task.acceptanceCriteria.filter((_, k) => k !== i) })}
                className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-center gap-2">
          <Plus className="ml-1 h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} />
          <input
            value={newAc}
            onChange={(e) => setNewAc(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAc())}
            onBlur={addAc}
            placeholder="新增驗收條件後按 Enter"
            aria-label="新增驗收條件"
            className="min-w-0 flex-1 rounded-lg border border-dashed border-gray-200 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />
        </div>
      </Section>

      {/* 6. 安排審查人員 */}
      <Section label="安排審查人員">
        <SegmentedControl<ReviewerMode>
          size="sm"
          aria-label="審查方式"
          value={task.reviewer.mode}
          onChange={(mode) =>
            onChange({ reviewer: { mode, memberId: mode === 'member' ? task.reviewer.memberId : null } })
          }
          options={(Object.keys(REVIEWER_LABELS) as ReviewerMode[]).map((m) => ({ value: m, label: REVIEWER_LABELS[m] }))}
        />
        {task.reviewer.mode === 'member' && (
          <Select
            aria-label="指定審查成員"
            className="mt-2"
            value={task.reviewer.memberId ?? ''}
            onChange={(e) => onChange({ reviewer: { mode: 'member', memberId: e.target.value || null } })}
          >
            <option value="">選擇審查成員</option>
            {members
              .filter((m) => m.id !== task.assigneeId && m.id !== leaderId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.title}
                </option>
              ))}
          </Select>
        )}
      </Section>

      {/* 7. 相依性 */}
      <DependencyEditor kind="task" item={task} />
    </div>
  );
}
