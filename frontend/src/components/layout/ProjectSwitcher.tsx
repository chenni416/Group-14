import { ChevronsUpDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const projectButton = (active: boolean) =>
  cn(
    'group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-150 md:h-11 md:w-11',
    active ? 'bg-accent-sky text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900',
  );

const addProject = () => toast('新增專案功能開發中');

/**
 * 側邊欄的專案切換（像 Discord 切換伺服器），點選後回到該專案的 Project Dashboard。
 * 桌機：垂直列出所有專案與「新增專案」；手機（側邊欄變成畫面底部的一排）：只顯示目前專案，點開選單切換。
 */
export function ProjectSwitcher() {
  const { currentId, setCurrentId } = useProjectStore();
  const current = DEMO_PROJECTS.find((p) => p.id === currentId) ?? DEMO_PROJECTS[0]!;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // 點任何專案（包含目前的專案）都回到該專案的 Project Dashboard
  const select = (id: string) => {
    const p = DEMO_PROJECTS.find((x) => x.id === id);
    setOpen(false);
    if (!p) return;
    navigate('/');
    if (id === currentId) return;
    setCurrentId(id);
    toast(`已切換到「${p.name}」`);
  };

  // 手機選單：點選單外或按 Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => menuRef.current?.contains(e.target as Node) || setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      {/* 桌機：垂直列表 */}
      <div className="hidden md:contents">
        {DEMO_PROJECTS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`切換到 ${p.name}`}
            aria-pressed={p.id === currentId}
            onClick={() => select(p.id)}
            className={projectButton(p.id === currentId)}
          >
            {p.short}
            <Tip label={p.name} />
          </button>
        ))}
        <button
          type="button"
          aria-label="新增專案"
          onClick={addProject}
          className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 transition-colors duration-150 hover:border-gray-400 hover:text-gray-700 md:h-11 md:w-11"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          <Tip label="新增專案" />
        </button>
      </div>

      {/* 手機：目前專案一顆按鈕，往上展開選單 */}
      <div ref={menuRef} className="relative md:hidden">
        <button
          type="button"
          aria-label={`目前專案：${current.name}，點選切換專案`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(projectButton(true), 'relative')}
        >
          {current.short}
          <ChevronsUpDown className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full bg-white p-0.5 text-gray-600 shadow-card" strokeWidth={2} />
        </button>
        {open && (
          <div role="menu" aria-label="切換專案" className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-pop">
            {DEMO_PROJECTS.map((p) => {
              const active = p.id === currentId;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => select(p.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors duration-150',
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50',
                  )}
                >
                  <span className={cn(projectButton(active), 'h-8 w-8 md:h-8 md:w-8')}>{p.short}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                addProject();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-gray-500 transition-colors duration-150 hover:bg-gray-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-gray-300">
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </span>
              新增專案
            </button>
          </div>
        )}
      </div>
    </>
  );
}
