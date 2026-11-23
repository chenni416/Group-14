import { Save, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Button, Card, CardHeader, Field, Input, PageHeader, PageSkeleton, Tag } from '@/components/ui';
import { useTeamMutations } from '@/features/team/hooks/useTeam';
import { useCurrentUser } from '@/hooks/queries';
import { useUpdateMe } from '@/hooks/useUpdateMe';
import { DOMAIN_KEYS, DOMAINS } from '@/lib/constants';
import { AUTH_ENABLED } from '@/lib/supabase';
import { toast } from '@/stores/toast.store';
import type { Domain, Member } from '@/types';

export function SettingsPage() {
  const { data: me } = useCurrentUser();
  if (!me) return <PageSkeleton />;

  // GitHub 登入模式：帳號資料來自 GitHub，只能修改顯示名稱
  if (AUTH_ENABLED) return <AccountForm key={me.id} member={me} />;
  // key 讓右上角切換身分時，表單會換成新使用者的資料
  return <ProfileForm key={me.id} member={me} />;
}

function AccountForm({ member }: { member: Member }) {
  const updateMe = useUpdateMe();
  const [displayName, setDisplayName] = useState(member.displayName ?? '');
  const login = member.githubLogin ?? '';
  const trimmed = displayName.trim();
  const unchanged = trimmed === (member.displayName ?? '');
  const shownName = trimmed || login;

  const save = () => updateMe.mutate({ displayName: trimmed || null });

  return (
    <>
      <PageHeader
        eyebrow="Personal Settings"
        title="個人設定"
        actions={
          <Button variant="primary" onClick={save} disabled={updateMe.isPending || unchanged || trimmed.length > 50}>
            <Save className="h-4 w-4" strokeWidth={1.75} />
            儲存
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="帳號" description="以 GitHub 帳號登入，帳號名稱同時是你在系統內的 ID" />
          <div className="mb-6 flex items-center gap-4">
            <Avatar member={{ name: shownName, avatarUrl: member.avatarUrl }} size="lg" />
            <div className="min-w-0">
              <div className="truncate font-medium text-gray-900">{shownName}</div>
              <div className="truncate text-sm text-gray-500">@{login}</div>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="顯示名稱" htmlFor="account-display-name">
              <Input
                id="account-display-name"
                value={displayName}
                maxLength={50}
                placeholder={login}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !unchanged && save()}
              />
              <p className="mt-1.5 text-xs text-gray-500">留空會使用 GitHub 帳號名稱 @{login}；每次登入不會覆蓋你自訂的名稱</p>
            </Field>
            <Field label="GitHub 帳號" htmlFor="account-github">
              <Input id="account-github" value={`@${login}`} disabled />
            </Field>
            <Field label="Email" htmlFor="account-email">
              <Input id="account-email" value={member.email || '（GitHub 未提供）'} disabled />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="專案內的設定" description="職稱、主要領域、專長標籤與可用時間依專案設定" />
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">加入或建立專案後，可以在專案中設定這些資料，AI 會依據它們推薦適合你的任務。</p>
        </Card>
      </div>
    </>
  );
}

function ProfileForm({ member }: { member: Member }) {
  const { update } = useTeamMutations();

  // 表單的每個欄位都用 state 記住目前輸入的值
  const [name, setName] = useState(member.name);
  const [title, setTitle] = useState(member.title);
  const [domain, setDomain] = useState<Domain>(member.domain);
  const [tags, setTags] = useState<string[]>(member.tags);
  const [tagInput, setTagInput] = useState('');
  // Demo：每週可用時數只存在畫面上，不寫入資料
  const [hours, setHours] = useState('15');

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = () => {
    update.mutate(
      { id: member.id, patch: { name, title, domain, tags } },
      { onSuccess: () => toast('個人設定已儲存') },
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Personal Settings"
        title="個人設定"
        actions={
          <Button variant="primary" onClick={handleSave} disabled={update.isPending || !name.trim()}>
            <Save className="h-4 w-4" strokeWidth={1.75} />
            儲存
          </Button>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {/* 左：基本資料 */}
        <Card>
          <CardHeader title="基本資料" />
          <div className="mb-6 flex items-center gap-4">
            <Avatar member={{ name: name || member.name }} size="lg" />
            <div>
              <div className="font-medium text-gray-900">{name || member.name}</div>
              <div className="text-sm text-gray-500">{member.role}</div>
            </div>
          </div>
          <div className="space-y-4">
            <Field label="姓名" htmlFor="profile-name">
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email（GitHub 帳號）" htmlFor="profile-email">
              <Input id="profile-email" value={member.email} disabled />
            </Field>
            <Field label="職稱" htmlFor="profile-title">
              <Input id="profile-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>
        </Card>

        {/* 右：專長與時間，給 AI 分配任務用 */}
        <Card>
          <CardHeader title="專長與可用時間" description="AI 會依據這些資料推薦適合你的任務" />
          <div className="space-y-6">
            <div>
              <div className="mb-1.5 text-xs font-medium text-gray-500">主要領域</div>
              <div className="flex flex-wrap gap-1.5">
                {DOMAIN_KEYS.map((d) => (
                  <Button
                    key={d}
                    size="xs"
                    variant={domain === d ? 'primary' : 'secondary'}
                    aria-pressed={domain === d}
                    onClick={() => setDomain(d)}
                  >
                    {DOMAINS[d].label}
                  </Button>
                ))}
              </div>
            </div>

            <Field label="專長標籤" htmlFor="profile-tag">
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 p-1.5">
                {tags.map((t) => (
                  <Tag key={t} className="pr-1">
                    {t}
                    <button
                      type="button"
                      aria-label={`移除 ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </Tag>
                ))}
                <input
                  id="profile-tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="輸入後按 Enter 新增"
                  className="min-w-[140px] flex-1 bg-transparent px-1.5 text-xs placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </Field>

            <Field label="每週可用時數" htmlFor="profile-hours">
              <div className="flex items-center gap-3">
                <Input
                  id="profile-hours"
                  type="number"
                  min={0}
                  max={60}
                  className="w-28 tabular-nums"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
                <span className="text-sm text-gray-500">小時 / 週，Sprint 期間可再微調</span>
              </div>
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
}