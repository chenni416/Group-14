import { ChevronsDownUp, ChevronsUpDown, X } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import { Avatar, Badge, Button, Card, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { sum } from '@/lib/format';
import { loadByMember } from '@/lib/planning';
import type { Member, TaskDraft } from '@/types';
import { usePlanningStore } from '../store';

export const TASK_DRAG_TYPE = 'application/x-taskline-task';
const UNASSIGNED = '__unassigned__';

interface Props {
  members: Member[];
  tasks: TaskDraft[];
  /**
   * stories：階段 A，尚未拆解 Task，只顯示各成員容量與「Story 預估 vs 全隊容量」對照；
   * tasks：階段 B，顯示任務小卡並可拖曳派工
   */
  phase?: 'stories' | 'tasks';
  /** 階段 A 用：目前 Story 總預估點數 */
  storyPoints?: number;
  /** 固定完整展開並隱藏收合按鈕（階段 C 派工總覽） */
  forceExpanded?: boolean;
  /** 隱藏「未指派」欄與小卡的取消指派按鈕，只能在成員之間拖曳（階段 C 派工總覽） */
  hideUnassigned?: boolean;
  /** 提供時啟用拖曳：拖到成員直欄為指派，拖回「未指派」或按移除為取消指派（memberId = null） */
  onAssign?: (taskId: string, memberId: string | null) => void;
  /** 點擊任務小卡 */
  onTaskClick?: (task: TaskDraft) => void;
  className?: string;
}

interface MiniTaskProps {
  task: TaskDraft;
  draggable: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

function MiniTask({ task, draggable, onClick, onRemove }: MiniTaskProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      title={task.title}
      className={cn(
        'group relative rounded-xl border border-gray-100 bg-white transition-colors duration-150 hover:border-gray-300',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <button type="button" onClick={onClick} className="block w-full px-2.5 py-2 text-left">
        <span className="flex items-center gap-2 pr-5">
          <span className="font-mono text-[11px] text-gray-500">{task.code}</span>
          <span className="text-[11px] font-medium tabular-nums text-gray-700">{task.storyPoints} SP</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-gray-900">{task.title}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`取消指派 ${task.code}`}
          title="取消指派"
          onClick={onRemove}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

interface ColumnProps {
  id: string;
  label: string;
  dropEnabled: boolean;
  dragOver: string | null;
  setDragOver: (v: string | null | ((d: string | null) => string | null)) => void;
  onDropTask: (taskId: string) => void;
  header: ReactNode;
  footer: ReactNode;
  dashed?: boolean;
}

/** 單一直欄：整欄都是放置區 */
function Column({ id, label, dropEnabled, dragOver, setDragOver, onDropTask, header, footer, dashed }: ColumnProps) {
  const isOver = dragOver === id;
  const accept = (e: DragEvent) => dropEnabled && e.dataTransfer.types.includes(TASK_DRAG_TYPE);
  return (
    <section
      aria-label={label}
      onDragOver={(e) => {
        if (!accept(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOver(id);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((d) => (d === id ? null : d));
      }}
      onDrop={(e) => {
        const taskId = e.dataTransfer.getData(TASK_DRAG_TYPE);
        setDragOver(null);
        if (taskId && dropEnabled) {
          e.preventDefault();
          onDropTask(taskId);
        }
      }}
      className={cn(
        'flex flex-col rounded-2xl border p-3 transition-colors duration-150',
        dashed ? 'border-dashed border-gray-200 bg-gray-50/60' : 'border-gray-100',
        isOver && 'border-transparent bg-neutral-50/50 ring-2 ring-neutral-900',
      )}
    >
      {header}
      {footer}
    </section>
  );
}

function EmptyDrop({ active, text }: { active: boolean; text: string }) {
  return (
    <div
      className={cn(
        'flex min-h-[52px] items-center justify-center rounded-xl border border-dashed text-xs transition-colors duration-150',
        active ? 'border-gray-900 text-gray-900' : 'border-gray-200 text-gray-400',
      )}
    >
      {active ? '放開以指派' : text}
    </div>
  );
}

/**
 * 全隊點數負載（正常綠色、超載紅色）。
 * 「未指派」欄 + 每位成員一個直欄；展開時依任務數量自然向下延伸（不限高），整欄皆可作為拖曳放置區。
 */
export function TeamCapacityBar({
  members,
  tasks,
  phase = 'tasks',
  storyPoints = 0,
  forceExpanded = false,
  hideUnassigned = false,
  onAssign,
  onTaskClick,
  className,
}: Props) {
  const { capacityExpanded, toggleCapacity } = usePlanningStore();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const load = loadByMember(members, tasks);
  const unassigned = tasks.filter((t) => !t.assigneeId);
  const unassignedSp = sum(unassigned.map((t) => t.storyPoints));
  const teamCapacity = sum(members.map((m) => m.capacity));
  const storyPhase = phase === 'stories';
  const expanded = !storyPhase && (forceExpanded || capacityExpanded);
  const dnd = !storyPhase && !!onAssign;

  const list = (items: TaskDraft[], removable: boolean, emptyText: string, columnId: string) =>
    expanded && (
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {items.length ? (
          items.map((t) => (
            <MiniTask
              key={t.id}
              task={t}
              draggable={dnd}
              onClick={onTaskClick && (() => onTaskClick(t))}
              onRemove={removable && !hideUnassigned && onAssign ? () => onAssign(t.id, null) : undefined}
            />
          ))
        ) : (
          <EmptyDrop active={dragOver === columnId} text={emptyText} />
        )}
      </div>
    );

  return (
    <Card className={cn('p-5', className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Team Capacity</h2>
          <p className="text-xs text-gray-500">
            {storyPhase
              ? '尚未拆解 Task。調整 Story 預估點數時，可對照各成員與全隊的可用容量'
              : dnd
                ? hideUnassigned
                  ? '拖曳任務卡到其他成員直欄即可重新指派'
                  : '拖曳任務卡到成員直欄即可指派；拖回「未指派」或按小卡上的移除按鈕可取消指派'
                : '各成員目前分配到的任務與點數負載'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {storyPhase ? (
            <Badge tone={storyPoints > teamCapacity ? 'red' : 'sky'} dot className="tabular-nums">
              Story 預估 {storyPoints} SP / 全隊容量 {teamCapacity} SP
            </Badge>
          ) : (
            <>
              {unassigned.length > 0 && (
                <Badge tone="orange" dot className="tabular-nums">
                  {unassigned.length} 張 Task 未指派 · {unassignedSp} SP
                </Badge>
              )}
              {!forceExpanded && (
                <Button size="xs" aria-expanded={capacityExpanded} onClick={toggleCapacity}>
                  {capacityExpanded ? (
                    <ChevronsDownUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                  ) : (
                    <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  {capacityExpanded ? '收合任務' : '展開全部任務'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', hideUnassigned ? 'xl:grid-cols-5' : 'xl:grid-cols-6')}>
        {!hideUnassigned && (
          <Column
            id={UNASSIGNED}
            label="未指派的任務欄"
            dashed
            dropEnabled={dnd}
            dragOver={dragOver}
            setDragOver={setDragOver}
            onDropTask={(id) => onAssign?.(id, null)}
            header={
              <>
                <div className="flex h-6 items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">未指派</span>
                  <span className="text-xs tabular-nums text-gray-500">{unassigned.length} 張</span>
                </div>
                <div className="mt-2.5 text-xs text-gray-500">
                  {storyPhase ? (
                    '尚未拆解 Task'
                  ) : (
                    <>
                      待分配 <span className="font-semibold tabular-nums text-gray-900">{unassignedSp} SP</span>
                    </>
                  )}
                </div>
              </>
            }
            footer={list(unassigned, false, '所有任務皆已指派', UNASSIGNED)}
          />
        )}

        {members.map((m) => {
          const v = load[m.id] ?? 0;
          const over = v > m.capacity;
          return (
            <Column
              key={m.id}
              id={m.id}
              label={`${m.name} 的任務欄`}
              dropEnabled={dnd}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onDropTask={(id) => onAssign?.(id, m.id)}
              header={
                <>
                  <div className="flex items-center gap-2">
                    <Avatar member={m} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900">{m.name}</span>
                  </div>
                  <div className="mb-1.5 mt-2.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className={cn('truncate', over ? 'font-medium text-red-600' : 'text-gray-500')}>
                      {over ? `超載 +${v - m.capacity}` : m.title}
                    </span>
                    <span className={cn('shrink-0 font-semibold tabular-nums', over ? 'text-red-600' : 'text-gray-900')}>
                      {v}/{m.capacity} SP
                    </span>
                  </div>
                  <ProgressBar value={v} max={m.capacity} tone={over ? 'red' : 'green'} size="sm" label={`${m.name} 負載`} />
                </>
              }
              footer={list(
                tasks.filter((t) => t.assigneeId === m.id),
                true,
                '尚無指派任務',
                m.id,
              )}
            />
          );
        })}
      </div>
    </Card>
  );
}
