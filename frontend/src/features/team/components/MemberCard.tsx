import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, Button, Input, Label, Select, Tag } from '@/components/ui';
import { DOMAIN_KEYS, DOMAINS } from '@/lib/constants';
import type { Member, MemberRole } from '@/types';
import { useTeamMutations } from '../hooks/useTeam';

export function MemberCard({ member, editable }: { member: Member; editable: boolean }) {
  const { update } = useTeamMutations();
  const [title, setTitle] = useState(member.title);
  const [capacity, setCapacity] = useState(String(member.capacity));
  const [tag, setTag] = useState('');
  useEffect(() => setTitle(member.title), [member.title]);
  useEffect(() => setCapacity(String(member.capacity)), [member.capacity]);

  const save = (patch: Partial<Member>) => update.mutate({ id: member.id, patch });

  return (
    <article className="rounded-2xl border border-gray-100 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar member={member} size="md" />
          <div className="min-w-0">
            <div className="truncate font-medium text-gray-900">{member.name}</div>
            <div className="truncate text-xs text-gray-500">{member.email}</div>
          </div>
        </div>
        <Select
          aria-label={`${member.name} 的角色`}
          className="w-28 shrink-0"
          value={member.role}
          disabled={!editable}
          onChange={(e) => save({ role: e.target.value as MemberRole })}
        >
          {(['Leader', 'Member'] as const).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>
      <div className="mb-4 grid grid-cols-[1fr_96px] gap-3">
        <div>
          <Label htmlFor={`title-${member.id}`}>職稱</Label>
          <Input
            id={`title-${member.id}`}
            value={title}
            disabled={!editable}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== member.title && save({ title })}
          />
        </div>
        <div>
          <Label htmlFor={`cap-${member.id}`}>Capacity SP</Label>
          <Input
            id={`cap-${member.id}`}
            type="number"
            min={1}
            max={30}
            className="tabular-nums"
            value={capacity}
            disabled={!editable}
            onChange={(e) => setCapacity(e.target.value)}
            onBlur={() => Number(capacity) !== member.capacity && save({ capacity: Number(capacity) || 1 })}
          />
        </div>
      </div>
      <Label>技術棧與領域標籤</Label>
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 p-1.5">
        {member.tags.map((t, i) => (
          <Tag key={`${t}-${i}`} className="pr-1">
            {t}
            {editable && (
              <button
                type="button"
                aria-label={`移除 ${t}`}
                onClick={() => save({ tags: member.tags.filter((_, k) => k !== i) })}
                className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </Tag>
        ))}
        {editable && (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tag.trim()) {
                save({ tags: [...member.tags, tag.trim()] });
                setTag('');
              }
            }}
            placeholder="新增標籤後按 Enter"
            aria-label="新增標籤"
            className="min-w-[120px] flex-1 bg-transparent px-1.5 text-xs placeholder:text-gray-400 focus:outline-none"
          />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-gray-500">主要領域</span>
        {DOMAIN_KEYS.map((d) => (
          <Button
            key={d}
            size="xs"
            variant={member.domain === d ? 'primary' : 'secondary'}
            disabled={!editable}
            aria-pressed={member.domain === d}
            onClick={() => save({ domain: d })}
          >
            {DOMAINS[d].label}
          </Button>
        ))}
      </div>
    </article>
  );
}
