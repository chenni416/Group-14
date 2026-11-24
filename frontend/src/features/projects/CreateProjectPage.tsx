import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GitPullRequest } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { Stepper } from '@/features/onboarding/components/Stepper';
import { cn } from '@/lib/cn';
import { startGithubLink } from '@/lib/githubLink';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import { useUiStore } from '@/stores/ui.store';

/** 與專案初始化相同的步驟；建立專案是第一步「基本資訊」 */
const STEPS = ['基本資訊', '專案知識庫', '成員技術特徵', 'Review 預設策略'];
const SPRINT_LENGTHS = ['1 週', '2 週', '3 週'];

/** 專案代碼只保留英文大寫與數字（與後端相同） */
const toPrefix = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/** GitHub repo：https://github.com/owner/repo、github.com/owner/repo 或 owner/repo（與後端相同） */
const REPO_PATTERN = /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;
const repoName = (value: string) => {
  const m = value.trim().match(REPO_PATTERN);
  return m && m[2] !== '.' && m[2] !== '..' ? `${m[1]}/${m[2]}` : null;
};

/**
 * 建立專案：直接進入專案初始化，第一步填寫基本資訊並建立專案（建立的人成為 Leader）。
 * 選擇整合 GitHub 時，建立後先前往 GitHub 安裝 App 並連結 repo，完成後回到初始化第二步；
 * 不整合時直接進入第二步。
 */
export function CreateProjectPage() {
  const [params] = useSearchParams();
  // 舊連結 /projects/new?mode=join：加入專案已改為獨立頁面
  if (params.get('mode') === 'join') return <Navigate to="/projects/join" replace />;
  return <CreateProjectForm />;
}

function CreateProjectForm() {
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [goal, setGoal] = useState('');
  const [sprintLength, setSprintLength] = useState('2 週');
  const [gitIntegration, setGitIntegration] = useState(true);
  const [repo, setRepo] = useState('');
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const setOnboardingStep = useUiStore((s) => s.setOnboardingStep);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const parsedRepo = repoName(repo);
  const repoInvalid = repo.trim() !== '' && parsedRepo === null;
  const repoMissing = gitIntegration && repo.trim() === '';

  const toOnboarding = async () => {
    await qc.invalidateQueries();
    setOnboardingStep(1);
    navigate('/onboarding');
  };

  const create = useMutation({
    mutationFn: () =>
      api.workspace.createProject({
        name: name.trim(),
        prefix,
        goal: goal.trim(),
        sprintLength,
        gitIntegration,
        repo: parsedRepo,
      }),
    onSuccess: async (project) => {
      // 之後的請求都以新專案為目前的專案
      setCurrentId(project.id);
      if (!gitIntegration) {
        toast(`已建立「${project.name}」，接著設定專案知識庫`);
        await toOnboarding();
        return;
      }
      // 整合 GitHub：先前往 GitHub 安裝 App 並連結 repo，完成後回到初始化第二步
      try {
        setOnboardingStep(1);
        await startGithubLink('onboarding');
      } catch (err) {
        toast(`已建立「${project.name}」，但無法前往 GitHub：${err instanceof Error ? err.message : '請稍後在團隊設定連結'}`);
        await toOnboarding();
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : '建立失敗'),
  });

  const canSubmit = name.trim() !== '' && prefix !== '' && goal.trim() !== '' && !repoMissing && !repoInvalid && !create.isPending;

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) create.mutate();
      }}
    >
      <PageHeader
        eyebrow="Project Onboarding & Context Hub"
        title="建立新專案"
        actions={<Stepper steps={STEPS} current={0} onChange={() => undefined} disabled className="" />}
      />

      <div className="grid flex-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="專案基本資訊" description="建立後你會成為這個專案的 Leader；之後都可以在專案設定修改" />
          <div className="space-y-4">
            <Field label="專案名稱" htmlFor="new-project-name">
              <Input
                id="new-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：Taskline — 會議到交付平台"
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="專案代碼（英文大寫或數字）" htmlFor="new-project-prefix">
                <Input
                  id="new-project-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(toPrefix(e.target.value))}
                  placeholder="例如：TL"
                  className="font-mono"
                />
              </Field>
              <Field label="Sprint 長度" htmlFor="new-project-length">
                <Select id="new-project-length" value={sprintLength} onChange={(e) => setSprintLength(e.target.value)}>
                  {SPRINT_LENGTHS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Project Goal（專案目標）" htmlFor="new-project-goal">
              <Textarea
                id="new-project-goal"
                rows={4}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
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
                { on: false, label: '不整合', text: '之後可以在團隊設定開啟' },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={gitIntegration === o.on}
                  onClick={() => setGitIntegration(o.on)}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-left transition-colors duration-150',
                    gitIntegration === o.on ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
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
            <Field label={gitIntegration ? 'Repository 連結' : 'Repository 連結（選填）'} htmlFor="new-project-repo">
              <Input
                id="new-project-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="font-mono"
                aria-invalid={repoInvalid}
              />
              {repoInvalid ? (
                <p className="mt-1.5 text-xs text-red-600">請輸入 GitHub repo，例如 https://github.com/owner/repo</p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">
                  {gitIntegration
                    ? '按下一步後會前往 GitHub 安裝 Taskline App 並授權這個 repo；不是 repo 擁有者時會送出安裝請求，等待擁有者核准'
                    : '可以先記錄 repo，之後在團隊設定開啟整合時再連結'}
                </p>
              )}
            </Field>
            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <div className="font-medium">建立後的下一步</div>
              <div className="mt-0.5 text-orange-800">
                {gitIntegration ? '連結 GitHub repo → ' : ''}上傳專案文件到知識庫 → 設定成員技術特徵 → Review 預設策略
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-between">
        <Button onClick={() => navigate(-1)}>取消</Button>
        <Button type="submit" variant="primary" disabled={!canSubmit} loading={create.isPending}>
          {gitIntegration ? '建立專案並連結 GitHub' : '建立專案並繼續'}
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      </div>
    </form>
  );
}
