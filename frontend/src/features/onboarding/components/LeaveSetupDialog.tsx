import { Button, Callout, Modal } from '@/components/ui'
import { useCancelCreate } from '@/features/projects/hooks/useCancelCreate'
import type { Project } from '@/types'

/**
 * 建立流程還沒完成就要離開時的確認：可以繼續設定、直接離開，或在左下角取消建立（刪除剛建立的專案）。
 */
export function LeaveSetupDialog({
  open,
  project,
  canCancel,
  onStay,
  onLeave,
  onBeforeCancel,
}: {
  open: boolean
  project: Project
  /** 只有 Leader 可以取消建立 */
  canCancel: boolean
  onStay: () => void
  onLeave: () => void
  /** 取消建立成功、跳回首頁前呼叫（放行離開確認） */
  onBeforeCancel: () => void
}) {
  const cancel = useCancelCreate(project, onBeforeCancel)

  return (
    <Modal
      open={open}
      onClose={onStay}
      title="還沒完成建立專案"
      className="max-w-md"
    >
      <p className="text-sm leading-relaxed text-gray-600">
        「{project.name}」已經建立，但後續設定還沒完成。確定要離開嗎？
      </p>
      <Callout tone="warning" className="mt-4">
        之後可到「專案設定」修改基本資訊等內容，以及至「組織與團隊設定」調整成員設定。
      </Callout>
      {canCancel && (
        <p className="mt-3 text-xs text-gray-500">
          不想建立這個專案了：按左下角「取消建立」會刪除「{project.name}」。
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {canCancel ? (
          <Button
            variant="ghost"
            className="text-red-600"
            loading={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            取消建立
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={onStay} disabled={cancel.isPending}>
            繼續設定
          </Button>
          <Button
            variant="primary"
            onClick={onLeave}
            disabled={cancel.isPending}
          >
            離開
          </Button>
        </div>
      </div>
    </Modal>
  )
}
