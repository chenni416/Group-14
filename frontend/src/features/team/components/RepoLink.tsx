import { useMutation } from '@tanstack/react-query';
import { ExternalLink, GitPullRequest } from 'lucide-react';
import { Badge, Button, ConfirmDialog } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDisclosure } from '@/hooks/useDisclosure';
import { startGithubLink } from '@/lib/githubLink';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { Project } from '@/types';

const STATUS: Record<NonNullable<Project['githubLinkStatus']>, { label: string; tone: 'sky' | 'orange' | 'neutral' | 'red' }> = {
  linked: { label: '已連結', tone: 'sky' },
  pending: { label: '等待擁有者核准', tone: 'orange' },
  none: { label: '尚未連結', tone: 'neutral' },
  revoked: { label: '權限被收回', tone: 'red' },
};

/** 團隊設定的 repo 連結狀態（Git 整合開啟時顯示）；Leader 可以連結、重新連結或解除連結 */
export function RepoLink({ project, editable }: { project: Project; editable: boolean }) {
  const status = project.githubLinkStatus ?? 'none';
  const confirm = useDisclosure();
  const link = useMutation({
    mutationFn: () => startGithubLink('team'),
    onError: (err) => toast(err instanceof Error ? err.message : '無法前往 GitHub'),
  });
  const unlink = useApiMutation({
    mutationFn: () => api.github.unlink(),
    invalidate: [['project']],
    onSuccess: () => {
      confirm.close();
      toast('已解除 repo 連結');
    },
  });

  return (
    <div className="space-y-2 py-3 text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500">Repository</span>
        <Badge tone={STATUS[status].tone} dot>
          {STATUS[status].label}
        </Badge>
      </div>
      {project.repo && (
        <a
          href={project.githubRepoUrl || `https://github.com/${project.repo}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-end gap-1 font-mono text-xs text-gray-900 underline-offset-4 hover:underline"
        >
          {project.repo}
          <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
        </a>
      )}
      {editable && (
        <div className="flex justify-end gap-2">
          {status === 'linked' ? (
            <Button size="xs" variant="ghost" onClick={confirm.open}>
              解除連結
            </Button>
          ) : (
            <Button size="xs" onClick={() => link.mutate()} loading={link.isPending}>
              <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.75} />
              {status === 'none' ? '連結 GitHub repo' : '重新連結'}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm.isOpen}
        onClose={confirm.close}
        onConfirm={() => unlink.mutate()}
        title="解除 repo 連結"
        description={`解除後不再同步 ${project.repo} 的 PR 與 CI 狀態；GitHub 上的 App 安裝不受影響，之後可以重新連結。`}
        confirmLabel="解除連結"
        loading={unlink.isPending}
      />
    </div>
  );
}
