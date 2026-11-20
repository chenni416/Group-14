import type { ReactNode } from 'react';
import { Button } from './Button';
import { Callout } from './Callout';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  /** 選填的簡短警示（例如成員超載） */
  warning?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

/** 精簡置中的確認小視窗 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmLabel = '確認',
  cancelLabel = '取消',
  loading = false,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
      {warning && (
        <Callout tone="warning" className="mt-4">
          {warning}
        </Callout>
      )}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant="primary" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
