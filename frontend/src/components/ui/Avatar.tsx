import { cn } from '@/lib/cn';
import type { Member } from '@/types';

const sizes = {
  xs: 'h-6 w-6 text-[11px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

interface Props {
  member: Pick<Member, 'name'> | undefined;
  size?: keyof typeof sizes;
  className?: string;
  muted?: boolean;
}

export function Avatar({ member, size = 'sm', className, muted }: Props) {
  return (
    <span
      title={member?.name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium',
        muted ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white',
        sizes[size],
        className,
      )}
    >
      {member?.name.slice(0, 1) ?? '?'}
    </span>
  );
}

export function AvatarStack({ members, size = 'xs', fadedIds = [] }: { members: (Member | undefined)[]; size?: keyof typeof sizes; fadedIds?: string[] }) {
  return (
    <span className="flex -space-x-1.5">
      {members.map((m, i) => (
        <Avatar
          key={m?.id ?? i}
          member={m}
          size={size}
          muted={!!m && fadedIds.includes(m.id)}
          className="ring-2 ring-white"
        />
      ))}
    </span>
  );
}
