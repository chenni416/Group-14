import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui';
import { ProjectBasicsForm } from '@/features/onboarding/components/ProjectBasicsForm';
import { ProjectSettingsLayout } from '@/features/onboarding/components/ProjectSettingsLayout';
import { CREATE_STEPS, checkBasics, parseRepo, type ProjectBasics } from '@/features/onboarding/projectBasics';
import { startGithubLink } from '@/lib/githubLink';
import { DEFAULT_SPRINT_LENGTH } from '@/lib/sprintLength';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import { useUiStore } from '@/stores/ui.store';
import type { ProjectSummary } from '@/types';

/**
 * 建立新專案：與專案設定共用版面，第一步「基本資訊」填寫後建立專案（建立的人成為 Leader）。
 * 之後在 /onboarding?setup=1 繼續「知識庫與 Review 策略」與「邀請成員」。
 * 選擇整合 GitHub 時，建立後先前往 GitHub 安裝 App 並連結 repo，完成後回到第二步；不整合時直接進入第二步。
 */
export function CreateProjectPage() {
  const [params] = useSearchParams();
  // 舊連結 /projects/new?mode=join：加入專案已改為獨立頁面
  if (params.get('mode') === 'join') return <Navigate to="/projects/join" replace />;
  return <CreateProjectForm />;
}

function CreateProjectForm() {
  const [value, setValue] = useState<ProjectBasics>({
    name: '',
    prefix: '',
    goal: '',
    sprintLength: DEFAULT_SPRINT_LENGTH,
    gitIntegration: true,
    repo: '',
  });
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const setOnboardingStep = useUiStore((s) => s.setOnboardingStep);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const toSettings = async () => {
    await qc.invalidateQueries();
    setOnboardingStep(1);
    navigate('/onboarding?setup=1');
  };

  const create = useMutation({
    mutationFn: () =>
      api.workspace.createProject({
        name: value.name.trim(),
        prefix: value.prefix,
        goal: value.goal.trim(),
        sprintLength: value.sprintLength,
        gitIntegration: value.gitIntegration,
        repo: parseRepo(value.repo),
      }),
    onSuccess: async (project) => {
      // 先把新專案加進「我的專案」清單，再切換：側邊欄才不會以為它不存在而改回舊專案
      qc.setQueryData<ProjectSummary[]>(queryKeys.projects, (list) => [...(list ?? []).filter((p) => p.id !== project.id), project]);
      // 之後的請求都以新專案為目前的專案
      setCurrentId(project.id);
      if (!value.gitIntegration) {
        toast(`已建立「${project.name}」，接著設定專案知識庫`);
        await toSettings();
        return;
      }
      // 整合 GitHub：先前往 GitHub 安裝 App 並連結 repo，完成後回到專案設定第二步
      try {
        setOnboardingStep(1);
        await startGithubLink('onboarding');
      } catch (err) {
        toast(`已建立「${project.name}」，但無法前往 GitHub：${err instanceof Error ? err.message : '請稍後在專案設定連結'}`);
        await toSettings();
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : '建立失敗'),
  });

  const canSubmit = checkBasics(value, 'create').valid && !create.isPending;

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      <ProjectSettingsLayout
        title="建立新專案"
        steps={CREATE_STEPS}
        step={0}
        footer={
          <>
            <Button onClick={() => navigate(-1)}>取消</Button>
            <Button type="submit" variant="primary" disabled={!canSubmit} loading={create.isPending}>
              {value.gitIntegration ? '建立專案並連結 GitHub' : '建立專案並繼續'}
              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </>
        }
      >
        <ProjectBasicsForm value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} mode="create" />
      </ProjectSettingsLayout>
    </form>
  );
}
