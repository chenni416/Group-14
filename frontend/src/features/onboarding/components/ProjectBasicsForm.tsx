import { useMutation } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import { Badge, Button, Card, CardHeader, ConfirmDialog, Field, Input, Select, Textarea } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDisclosure } from '@/hooks/useDisclosure';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import { cn } from '@/lib/cn';
import { SPRINT_UNITS, formatSprintLength, parseSprintLength, sprintCounts, type SprintUnit } from '@/lib/sprintLength';
import type { Project } from '@/types';
import { checkBasics, toPrefix, type ProjectBasics } from '../projectBasics';

function SprintLengthField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const { count, unit } = parseSprintLength(value);
  return (
    <Field label="Sprint 長度" htmlFor="project-sprint-count">
      <div className="grid grid-cols-2 gap-2">
        <Select
          id="project-sprint-count"
          aria-label="Sprint 長度數字"
          value={count}
          disabled={disabled}
          onChange={(e) => onChange(formatSprintLength(Number(e.target.value), unit))}
        >
          {sprintCounts(unit).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sprint 長度單位"
          value={unit}
          disabled={disabled}
          // 切換單位時數字超出範圍會自動調整（例如 6 天 → 4 週）
          onChange={(e) => onChange(formatSprintLength(count, e.target.value as SprintUnit))}
        >
          {SPRINT_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
    </Field>
  );
}

const LINK_STATUS: Record<NonNullable<Project['githubLinkStatus']>, { label: string; tone: 'sky' | 'orange' | 'neutral' | 'red' }> = {
  linked: { label: '已連結', tone: 'sky' },
  pending: { label: '等待擁有者核准', tone: 'orange' },
  none: { label: '尚未連結', tone: 'neutral' },
  revoked: { label: '權限被收回', tone: 'red' },
};

/** 設定模式 Repository 欄位下方的連結狀態與操作：已連結可以解除，未連結可以前往 GitHub 連結 */
function RepoStatus({
  project,
  linked,
  editable,
  onLink,
}: {
  project: Project;
  linked: boolean;
  editable: boolean;
  onLink?: () => Promise<void>;
}) {
  const status = project.githubLinkStatus ?? 'none';
  const confirm = useDisclosure();
  const link = useMutation({
    mutationFn: async () => onLink?.(),
    onError: (err) => toast(err instanceof Error ? err.message : '無法前往 GitHub'),
  });
  const unlink = useApiMutation({
    mutationFn: () => api.github.unlink(),
    invalidate: [['project']],
    onSuccess: () => {
      confirm.close();
      toast('已解除 repo 連結，可以修改 Repository 後重新連結');
    },
  });

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3">
      <Badge tone={LINK_STATUS[status].tone} dot>
        {LINK_STATUS[status].label}
      </Badge>
      {editable &&
        (linked ? (
          <Button size="xs" variant="ghost" onClick={confirm.open}>
            解除連結
          </Button>
        ) : (
          <Button size="xs" onClick={() => link.mutate()} loading={link.isPending}>
            <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.75} />
            {status === 'none' ? '連結 GitHub repo' : '重新連結'}
          </Button>
        ))}
      <ConfirmDialog
        open={confirm.isOpen}
        onClose={confirm.close}
        onConfirm={() => unlink.mutate()}
        title="解除 repo 連結"
        description={`解除後不再同步 ${project.repo} 的 PR 與 CI 狀態，Repository 欄位會恢復成可以修改；GitHub 上的 App 安裝不受影響。`}
        confirmLabel="解除連結"
        loading={unlink.isPending}
      />
    </div>
  );
}

/**
 * 建立新專案與專案設定共用的「基本資訊」：左邊專案資料，右邊 Git 整合。
 * - 建立模式：填寫 repo，建立後進入 GitHub App 安裝流程
 * - 設定模式：專案代碼不能修改；repo 由連結區塊管理（連結、重新連結、解除連結）
 */
export function ProjectBasicsForm({
  value,
  onChange,
  mode,
  editable = true,
  project,
  onLink,
}: {
  value: ProjectBasics;
  onChange: (patch: Partial<ProjectBasics>) => void;
  mode: 'create' | 'edit';
  /** 設定模式只有 Leader 可以修改 */
  editable?: boolean;
  /** 設定模式的目前專案（顯示 repo 連結狀態） */
  project?: Project;
  /** 設定模式按「連結 GitHub repo」：由頁面先儲存變更再前往 GitHub */
  onLink?: () => Promise<void>;
}) {
  const { repoInvalid } = checkBasics(value, mode);
  const disabled = !editable;
  // 已連結的 repo 不能直接修改，要先解除連結
  const linked = mode === 'edit' && project?.githubLinkStatus === 'linked';
  const repoHint =
    mode === 'create'
      ? value.gitIntegration
        ? '按下一步後會前往 GitHub 安裝 Taskline App 並授權這個 repo；不是 repo 擁有者時會送出安裝請求，等待擁有者核准'
        : '可以先記錄 repo，之後在專案設定開啟整合時再連結'
      : linked
        ? '已連結這個 repo；要更換請先解除連結'
        : value.gitIntegration
          ? '按「連結 GitHub repo」會先儲存變更，再前往 GitHub 安裝 Taskline App 並授權這個 repo'
          : '可以先記錄 repo，開啟整合後再連結';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="專案基本資訊"
          description={mode === 'create' ? '建立後你會成為這個專案的 Leader；之後都可以在專案設定修改' : editable ? '修改後按「儲存變更」' : '僅 Leader 可以修改'}
        />
        <div className="space-y-4">
          <Field label="專案名稱" htmlFor="project-name">
            <Input
              id="project-name"
              value={value.name}
              disabled={disabled}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="例如：Taskline — 會議到交付平台"
              autoFocus={mode === 'create'}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === 'create' ? '專案代碼（英文大寫或數字）' : '專案代碼（建立後不能修改）'} htmlFor="project-prefix">
              <Input
                id="project-prefix"
                value={value.prefix}
                disabled={disabled || mode === 'edit'}
                onChange={(e) => onChange({ prefix: toPrefix(e.target.value) })}
                placeholder="例如：TL"
                className="font-mono"
              />
            </Field>
            <SprintLengthField value={value.sprintLength} onChange={(sprintLength) => onChange({ sprintLength })} disabled={disabled} />
          </div>
          <Field label="Project Goal（專案目標）" htmlFor="project-goal">
            <Textarea
              id="project-goal"
              rows={3}
              value={value.goal}
              disabled={disabled}
              onChange={(e) => onChange({ goal: e.target.value })}
              placeholder="這個專案最終要達成什麼？會顯示在 Sprint 總覽與 Dashboard。"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Git 整合" description="整合後，PR、審查與 CI 狀態會同步到對應的任務" />
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Git 整合" className="grid grid-cols-2 gap-2">
            {[
              { on: true, label: '整合 GitHub', text: '連結 repo，同步 PR 與 CI' },
              { on: false, label: '不整合', text: mode === 'create' ? '之後可以在專案設定開啟' : '不連結 repo' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={value.gitIntegration === o.on}
                disabled={disabled}
                onClick={() => onChange({ gitIntegration: o.on })}
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed',
                  value.gitIntegration === o.on ? 'border-gray-900 bg-gray-50' : 'border-gray-200 enabled:hover:bg-gray-50',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  {o.on && <GitPullRequest className="h-4 w-4 text-accent-sky" strokeWidth={1.75} />}
                  {o.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">{o.text}</span>
              </button>
            ))}
          </div>

          <Field label={value.gitIntegration ? 'Repository 連結' : 'Repository 連結（選填）'} htmlFor="project-repo">
            <Input
              id="project-repo"
              value={value.repo}
              disabled={disabled || linked}
              onChange={(e) => onChange({ repo: e.target.value })}
              placeholder="https://github.com/owner/repo"
              className="font-mono"
              aria-invalid={repoInvalid}
            />
            {repoInvalid ? (
              <p className="mt-1.5 text-xs text-red-600">請輸入 GitHub repo，例如 https://github.com/owner/repo</p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">{repoHint}</p>
            )}
          </Field>

          {mode === 'edit' && value.gitIntegration && project && (
            <RepoStatus project={project} linked={linked} editable={editable} onLink={onLink} />
          )}

          {mode === 'create' && (
            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <div className="font-medium">建立後的下一步</div>
              <div className="mt-0.5 text-orange-800">
                {value.gitIntegration ? '連結 GitHub repo → ' : ''}上傳專案文件到知識庫 → 設定成員技術特徵 → Review 預設策略
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
