import { Plus } from 'lucide-react';
import { useState } from 'react';
import { TypeToConfirmDialog } from '@/components/domain/TypeToConfirmDialog';
import { Button, Card, CardHeader, PageHeader, PageSkeleton } from '@/components/ui';
import { useCurrentUser, useMembers, useProject } from '@/hooks/queries';
import { useDisclosure } from '@/hooks/useDisclosure';
import { DOMAIN_KEYS, DOMAINS } from '@/lib/constants';
import { isLead } from '@/lib/permissions';
import { toast } from '@/stores/toast.store';
import type { Member } from '@/types';
import { InviteMemberDialog } from './components/InviteMemberDialog';
import { JoinRequests } from './components/JoinRequests';
import { MemberCard } from './components/MemberCard';
import { PendingInvitations } from './components/PendingInvitations';
import { useTeamMutations } from './hooks/useTeam';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[88px]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

/** 組織與團隊設定：團隊人數統計與成員角色、技術特徵；Leader 可以邀請與移出成員 */
export function TeamPage() {
  const { data: members } = useMembers();
  const { data: me } = useCurrentUser();
  const { data: project } = useProject();
  const { remove } = useTeamMutations();
  const invite = useDisclosure();
  const [removing, setRemoving] = useState<Member | null>(null);

  if (!members || !me || !project) return <PageSkeleton />;
  const lead = isLead(me);
  const leaders = members.filter((m) => m.role === 'Leader').length;
  // 只列出有成員的領域
  const domains = DOMAIN_KEYS.map((d) => ({ d, count: members.filter((m) => m.domain === d).length })).filter((x) => x.count > 0);

  return (
    <>
      <PageHeader
        eyebrow="Organization & Team"
        title="組織與團隊設定"
        actions={
          <Button variant="primary" onClick={() => (lead ? invite.open() : toast('只有 Leader 可以邀請成員'))}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            邀請成員
          </Button>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="團隊人數" />
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <Stat label="成員總數" value={members.length} />
            <Stat label="Leader" value={leaders} />
            <Stat label="Member" value={members.length - leaders} />
            {domains.length > 0 && <span className="hidden h-12 w-px self-center bg-gray-100 sm:block" aria-hidden />}
            {domains.map(({ d, count }) => (
              <Stat key={d} label={DOMAINS[d].label} value={count} />
            ))}
          </div>
        </Card>
        {lead && <JoinRequests />}
        {lead && <PendingInvitations />}
        <Card>
          <CardHeader
            title="成員角色與技術特徵"
            description={lead ? 'AI 推薦指派會依據這些資料' : '僅 Leader 可編輯'}
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                editable={lead}
                onRemove={lead && m.id !== me.id && m.role !== 'Leader' ? () => setRemoving(m) : undefined}
              />
            ))}
          </div>
        </Card>
      </div>
      <InviteMemberDialog open={invite.isOpen} onClose={invite.close} />

      {removing && (
        <TypeToConfirmDialog
          open
          onClose={() => setRemoving(null)}
          onConfirm={() => remove.mutate(removing, { onSuccess: () => setRemoving(null) })}
          title="移出專案"
          description={<>確定要將 {removing.name} 移出「{project.name}」嗎？</>}
          consequences={['他將看不到這個專案的任何資料', '他負責中的任務需要重新指派', '他的帳號不受影響，之後可以再邀請回來']}
          expected={removing.githubLogin ?? removing.name}
          label={`請輸入${removing.githubLogin ? ' GitHub 帳號' : '成員名稱'}「${removing.githubLogin ?? removing.name}」以確認`}
          confirmLabel="移出專案"
          loading={remove.isPending}
        />
      )}
    </>
  );
}
