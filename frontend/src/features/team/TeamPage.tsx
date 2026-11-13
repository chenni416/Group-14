import { GitPullRequest, Plus, Users } from 'lucide-react';
import { Badge, Button, Card, CardHeader, IconButton, PageHeader, PageSkeleton } from '@/components/ui';
import { useCurrentUser, useMembers, useOrganization } from '@/hooks/queries';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/cn';
import { isLead } from '@/lib/permissions';
import { toast } from '@/stores/toast.store';
import { InviteMemberDialog } from './components/InviteMemberDialog';
import { MemberCard } from './components/MemberCard';
import { PermissionMatrix } from './components/PermissionMatrix';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{children}</span>
    </div>
  );
}

export function TeamPage() {
  const { data: org } = useOrganization();
  const { data: members } = useMembers();
  const { data: me } = useCurrentUser();
  const invite = useDisclosure();

  if (!org || !members || !me) return <PageSkeleton />;
  const lead = isLead(me);

  return (
    <>
      <PageHeader
        eyebrow="Organization & Team"
        title="組織與團隊設定"
        actions={
          <Button variant="primary" onClick={() => (lead ? invite.open() : toast('只有 Leader / PO 可以邀請成員'))}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            邀請成員
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="組織" action={<Badge>{org.plan} Plan</Badge>} />
            <div className="divide-y divide-gray-100">
              <Row label="組織名稱">{org.name}</Row>
              <Row label="Workspace">
                <span className="font-mono text-xs">taskline.app/{org.slug}</span>
              </Row>
              <Row label="Git 整合">
                <span className="inline-flex items-center gap-1.5">
                  <GitPullRequest className="h-4 w-4" strokeWidth={1.75} />
                  GitHub 已連結
                </span>
              </Row>
              <Row label="成員">
                <span className="tabular-nums">{members.length} 人</span>
              </Row>
            </div>
          </Card>
          <Card>
            <CardHeader
              title="團隊"
              action={
                <IconButton aria-label="新增團隊" size="sm" onClick={() => toast('新增團隊需組織管理員權限')}>
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                </IconButton>
              }
            />
            <div className="divide-y divide-gray-100">
              {org.teams.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        t.current ? 'bg-neutral-900 text-white' : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      <Users className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    {t.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums text-gray-500">{t.memberCount} 人</span>
                    {t.current && <Badge tone="sky" dot>目前</Badge>}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="角色權限" />
            <PermissionMatrix />
          </Card>
        </div>
        <Card>
          <CardHeader
            title="成員角色與技術特徵"
            description={lead ? 'AI 推薦指派會依據這些資料' : '僅 Leader / PO 可編輯'}
          />
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} editable={lead} />
            ))}
          </div>
        </Card>
      </div>
      <InviteMemberDialog open={invite.isOpen} onClose={invite.close} />
    </>
  );
}
