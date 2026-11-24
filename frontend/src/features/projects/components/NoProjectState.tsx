import { FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui';
import { useDisclosure } from '@/hooks/useDisclosure';
import { ProjectEntryDialog } from './ProjectEntryDialog';

/** 還沒有加入任何專案時，需要專案的頁面改顯示這個畫面 */
export function NoProjectState() {
  const entry = useDisclosure();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <FolderOpen className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">尚未加入專案</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">這個頁面會顯示專案的資料。建立新專案，或用邀請加入現有專案後就可以使用。</p>
      <Button variant="primary" className="mt-6" onClick={entry.open}>
        建立或加入專案
      </Button>
      <ProjectEntryDialog open={entry.isOpen} onClose={entry.close} />
    </div>
  );
}
