import { useQueryClient } from '@tanstack/react-query';
import { GitPullRequest, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TypeToConfirmDialog } from '@/components/domain/TypeToConfirmDialog';
import { Badge, Button, Card, CardHeader, IconButton, PageHeader, PageSkeleton } from '@/components/ui';
import { useCurrentUser, useMembers, useOrganization, useProject } from '@/hooks/queries';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDisclosure } from '@/hooks/useDisclosure';
import { cn } from '@/lib/cn';
import { isLead } from '@/lib/permissions';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import type { Member } from '@/types';
import { useOnboardingMutations } from '@/features/onboarding/hooks/useOnboarding';
import { InviteMemberDialog } from './components/InviteMemberDialog';
import { JoinCodeCard } from './components/JoinCodeCard';
import { JoinRequests } from './components/JoinRequests';
import { MemberCard } from './components/MemberCard';
import { PendingInvitations } from './components/PendingInvitations';
import { PermissionMatrix } from './components/PermissionMatrix';
import { RepoLink } from './components/RepoLink';
import { useTeamMutations } from './hooks/useTeam';

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
  const { data: project } = useProject();
  const { updateProject } = useOnboardingMutations();
  const { remove } = useTeamMutations();
  const invite = useDisclosure();
  const deleteDialog = useDisclosure();
  const [removing, setRemoving] = useState<Member | null>(null);
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const deleteProject = useApiMutation({
    mutationFn: (confirmName: string) => api.workspace.deleteProject(confirmName),
    invalidate: [],
    onSuccess: async (_, name) => {
      deleteDialog.close();
      // 改用剩下的專案；沒有專案時首頁是歡迎頁
      setCurrentId('');
      await qc.invalidateQueries();
      navigate('/');
      toast(`已刪除「${name}」`);
    },
  });

  if (!org || !members || !me || !project) return <PageSkeleton />;
  const lead = isLead(me);
  // 是否整合 Git：選「整合」後，repo 連結與同步由 GitHub 整合設定
  const setGit = (on: boolean) => {
    if (!lead) return toast('只有 Leader 可以設定');
    if (on !== project.gitIntegration) updateProject.mutate({ gitIntegration: on });
  };

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
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1">
                  {[
                    { on: true, label: '整合 GitHub' },
                    { on: false, label: '不整合' },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={project.gitIntegration === o.on}
                      disabled={updateProject.isPending}
                      onClick={() => setGit(o.on)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-colors',
                        project.gitIntegration === o.on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
                      )}
                    >
                      {o.on && <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      {o.label}
                    </button>
                  ))}
                </span>
              </Row>
              {project.gitIntegration && <RepoLink project={project} editable={lead} />}
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
          {lead && (
            <Card className="border-red-100">
              <CardHeader title="刪除專案" description="刪除後專案的所有資料都會移除，無法復原" />
              <Button variant="danger" onClick={deleteDialog.open}>
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                刪除這個專案
              </Button>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          {lead && <JoinRequests />}
          {lead && <PendingInvitations />}
          {lead && <JoinCodeCard />}
          <Card>
            <CardHeader
              title="成員角色與技術特徵"
              description={lead ? 'AI 推薦指派會依據這些資料' : '僅 Leader 可編輯'}
            />
            <div className="grid gap-4 md:grid-cols-2">
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
      </div>
      <InviteMemberDialog open={invite.isOpen} onClose={invite.close} />

      <TypeToConfirmDialog
        open={deleteDialog.isOpen}
        onClose={deleteDialog.close}
        onConfirm={() => deleteProject.mutate(project.name)}
        title="刪除專案"
        description={<>確定要刪除「{project.name}」嗎？刪除後無法復原。</>}
        consequences={[
          '專案的 Sprint、任務、文件與回顧紀錄會一併刪除',
          '所有成員都會被移出這個專案',
          '連結的 GitHub 同步資料會刪除（repo 本身不受影響）',
        ]}
        expected={project.name}
        label={`請輸入專案名稱「${project.name}」以確認`}
        confirmLabel="刪除專案"
        loading={deleteProject.isPending}
      />

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
