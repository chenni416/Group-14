import { UserRound, UserX } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { GithubAvatarStatus } from '@/hooks/useGithubAvatar';

/** 邀請時輸入框旁的頭像預覽：找到帳號顯示頭像，找不到顯示提示圖示 */
export function GithubAvatarPreview({ status, src }: { status: GithubAvatarStatus; src: string | null }) {
  if (status === 'found' && src) return <img src={src} alt="" className="h-9 w-9 shrink-0 rounded-full bg-gray-100" />;
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        status === 'missing' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400',
        status === 'loading' && 'animate-pulse',
      )}
    >
      {status === 'missing' ? <UserX className="h-4 w-4" strokeWidth={1.75} /> : <UserRound className="h-4 w-4" strokeWidth={1.75} />}
    </span>
  );
}

