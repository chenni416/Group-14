import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * 吸頂的固定視窗高度工作區（Sticky Split View）。
 * 桌面寬度下：上方 Team Capacity 捲出視線後，此區塊停在主內容區頂端並填滿可視高度，
 * 內部各欄自行捲動、底部操作列常駐。
 *
 * 高度計算：主內容區可視高度（100vh − 外框與頂部列 88px）− 內容區上下內距 64px = 100vh − 152px，
 * 捲到底時恰好填滿可視區。區塊位於頁面最後，通常在吸頂觸發前即到底；
 * 若之後在下方加入內容，會依 top-4 停在距主內容區頂端 48px 處。
 */
export function StickyWorkspace({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <section
      aria-label={label}
      className={cn('flex flex-col gap-4 lg:sticky lg:top-4 lg:h-[calc(100vh-152px)] lg:min-h-[520px]', className)}
    >
      {children}
    </section>
  );
}
