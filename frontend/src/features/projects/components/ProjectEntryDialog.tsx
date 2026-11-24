import { ArrowRight, FolderPlus, MailOpen, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/cn';

const OPTIONS: { to: string; icon: LucideIcon; tone: string; title: string; text: string }[] = [
  {
    to: '/projects/new',
    icon: FolderPlus,
    tone: 'bg-orange-50 text-accent-orange',
    title: '建立新專案',
    text: '填寫專案基本資訊，建立後你會成為 Leader',
  },
  {
    to: '/projects/join',
    icon: MailOpen,
    tone: 'bg-sky-50 text-accent-sky',
    title: '加入現有專案',
    text: '輸入邀請碼，或接受以 GitHub 帳號收到的邀請',
  },
];

/** 點「建立或加入專案」時先問使用者要做哪一件事，再前往對應的頁面 */
export function ProjectEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="建立或加入專案" description="你想要建立新專案，還是加入別人的專案？" className="max-w-lg">
      <div className="space-y-3">
        {OPTIONS.map((o) => (
          <button
            key={o.to}
            type="button"
            onClick={() => {
              onClose();
              navigate(o.to);
            }}
            className="group flex w-full items-center gap-4 rounded-2xl border border-gray-200 p-4 text-left transition-colors duration-150 hover:border-gray-900"
          >
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', o.tone)}>
              <o.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-gray-900">{o.title}</span>
              <span className="mt-0.5 block text-sm text-gray-500">{o.text}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-colors duration-150 group-hover:text-gray-900" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </Modal>
  );
}
