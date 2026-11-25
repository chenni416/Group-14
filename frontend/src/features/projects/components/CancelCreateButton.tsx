import { Button, ConfirmDialog } from '@/components/ui';
import { useDisclosure } from '@/hooks/useDisclosure';
import type { Project } from '@/types';
import { useCancelCreate } from '../hooks/useCancelCreate';

/**
 * 建立新專案流程中的「取消建立」：刪除剛建立的專案，回到原本的專案（沒有其他專案時為歡迎頁）。
 * 只出現在建立流程（/onboarding?setup=1），之後的專案設定改用需要輸入名稱的「刪除專案」。
 */
export function CancelCreateButton({
  project,
  onBeforeLeave,
}: {
  project: Project;
  /** 離開建立流程前通知頁面（放行離開確認） */
  onBeforeLeave?: () => void;
}) {
  const dialog = useDisclosure();
  const cancel = useCancelCreate(project, () => {
    dialog.close();
    onBeforeLeave?.();
  });

  return (
    <>
      <Button variant="ghost" onClick={dialog.open}>
        取消建立
      </Button>
      <ConfirmDialog
        open={dialog.isOpen}
        onClose={dialog.close}
        onConfirm={() => cancel.mutate()}
        title="取消建立專案"
        description={`會刪除剛建立的「${project.name}」，包含已上傳的文件、送出的邀請與邀請碼；GitHub 上的 repo 不受影響。`}
        confirmLabel="取消建立"
        cancelLabel="繼續設定"
        loading={cancel.isPending}
      />
    </>
  );
}
