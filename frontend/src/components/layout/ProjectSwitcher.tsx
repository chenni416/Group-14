import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DEMO_PROJECTS, useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';

/** 滑鼠移上去時顯示的專案名稱 */
function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-20 ml-3 hidden whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1.5 text-xs text-white group-hover:md:block">
      {label}
    </span>
  );
}

export function ProjectSwitcher() {
  const { currentId, setCurrentId } = useProjectStore();

  return (
    <>
      {DEMO_PROJECTS.map((p) => {
        const active = p.id === currentId;
        return (
          <button
            key={p.id}
            type="button"
            aria-label={`切換到 ${p.name}`}
            aria-pressed={active}
            onClick={() => {
              setCurrentId(p.id);
              if (!active) toast(`已切換到「${p.name}」`);
            }}
            className={cn(
              'group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150 md:h-11 md:w-11',
              active
                ? 'bg-accent-sky text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900',
            )}
          >
            {p.short}
            <Tip label={p.name} />
          </button>
        );
      })}
      <button
        type="button"
        aria-label="新增專案"
        onClick={() => toast('新增專案功能開發中')}
        className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors duration-150 hover:border-gray-400 hover:text-gray-700 md:h-11 md:w-11"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        <Tip label="新增專案" />
      </button>
    </>
  );
}