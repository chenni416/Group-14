import { useState, type ReactNode } from 'react';
import { Button, Callout, Field, Input, Modal } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  /** 會一併刪除或受影響的內容 */
  consequences: string[];
  /** 需要輸入的文字（例如專案名稱），完全相同才能按下確認 */
  expected: string;
  /** 輸入框上方的說明，例如「請輸入專案名稱」 */
  label: string;
  confirmLabel: string;
  loading?: boolean;
}

/** 無法復原的操作：說明後果，並要求再次輸入名稱才能確認 */
export function TypeToConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  consequences,
  expected,
  label,
  confirmLabel,
  loading = false,
}: Props) {
  const [value, setValue] = useState('');
  const matched = value.trim() === expected;
  const close = () => {
    setValue('');
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={title} className="max-w-md">
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
      <Callout tone="danger" className="mt-4">
        <ul className="list-disc space-y-1 pl-4">
          {consequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Callout>
      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (matched && !loading) onConfirm();
        }}
      >
        <Field label={label} htmlFor="type-to-confirm">
          <Input id="type-to-confirm" value={value} onChange={(e) => setValue(e.target.value)} placeholder={expected} autoComplete="off" autoFocus />
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={close} disabled={loading}>
            取消
          </Button>
          <Button type="submit" variant="danger" disabled={!matched} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
