import { ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useCurrentUser, useMembers } from '@/hooks/queries';
import { useSwitchUser } from '@/hooks/useSwitchUser';

/** 示範用身分切換：Leader 與 Member 會看到不同的操作權限 */
export function UserSwitcher() {
  const { data: me } = useCurrentUser();
  const { data: members } = useMembers();
  const switchUser = useSwitchUser();

  return (
    <div className="relative flex h-10 shrink-0 items-center gap-2.5 rounded-full border border-gray-200 bg-white pl-1 pr-3 transition-colors duration-150 hover:bg-gray-50">
      <Avatar member={me} size="sm" />
      <div className="hidden leading-tight sm:block">
        <div className="text-sm font-medium text-gray-900">{me?.name ?? '—'}</div>
        <div className="text-[11px] text-gray-500">{me ? `${me.role} · ${me.title}` : ''}</div>
      </div>
      <ChevronDown className="h-4 w-4 text-gray-400" strokeWidth={1.75} />
      <select
        aria-label="切換身分"
        value={me?.id ?? ''}
        onChange={(e) => switchUser.mutate(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {members?.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}（{m.role}）
          </option>
        ))}
      </select>
    </div>
  );
}
