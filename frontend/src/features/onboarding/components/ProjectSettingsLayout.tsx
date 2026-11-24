import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui';
import { Stepper } from './Stepper';

/**
 * 建立新專案與專案設定共用的版面：標題在左、步驟在右上角，下方為步驟內容與操作列。
 * 建立模式的步驟不能點（專案還不存在）；設定模式可以自由切換步驟。
 */
export function ProjectSettingsLayout({
  title,
  steps,
  step,
  onStepChange,
  children,
  footer,
}: {
  title: string;
  steps: string[];
  step: number;
  /** 沒有傳入時步驟只顯示進度、不能點選 */
  onStepChange?: (step: number) => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Project Settings & Context Hub"
        title={title}
        actions={
          <Stepper steps={steps} current={step} onChange={onStepChange ?? (() => undefined)} disabled={!onStepChange} className="" />
        }
      />
      <div className="flex-1">{children}</div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">{footer}</div>
    </div>
  );
}
