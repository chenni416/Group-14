import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui';
import { CollabPanel } from '@/features/board/components/CollabPanel';
import { TaskStudioDrawer } from '@/features/task-studio/TaskStudioDrawer';
import { useDisclosure } from '@/hooks/useDisclosure';
import { MAIN_SCROLL_ID, scrollMainToTop } from '@/lib/mainScroll';
import { HelpModal } from './HelpModal';
import { RequireProject } from './RequireProject';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

/**
 * 固定外殼：視窗本身不捲動。
 * 頂部列（Logo 在左上角）→ 下方左側 Icon 選單 + 右側白色主工作區，只有主工作區內部捲動。
 */
export function AppShell() {
  const help = useDisclosure();
  const { pathname } = useLocation();

  useEffect(() => scrollMainToTop(), [pathname]);

  return (
    <div className="mx-auto flex h-screen max-w-[1680px] flex-col gap-4 overflow-hidden p-3 text-gray-900 sm:p-4">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-3 md:flex-row md:gap-4">
        <SideNav onHelp={help.open} />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-white">
          <div id={MAIN_SCROLL_ID} className="scrollbar-thin flex flex-1 flex-col overflow-y-auto p-5 sm:p-8 [&>*]:shrink-0">
            <RequireProject>
              <Outlet />
            </RequireProject>
          </div>
        </main>
      </div>
      <CollabPanel />
      <TaskStudioDrawer />
      <HelpModal open={help.isOpen} onClose={help.close} />
      <Toaster />
    </div>
  );
}
