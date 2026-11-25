import { Check, Save } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, PageSkeleton } from '@/components/ui';
import { CancelCreateButton } from '@/features/projects/components/CancelCreateButton';
import { DeleteProjectButton } from '@/features/projects/components/DeleteProjectButton';
import { useCurrentUser, useDocs, useMembers, useProject } from '@/hooks/queries';
import { scrollMainToTop } from '@/lib/mainScroll';
import { isLead } from '@/lib/permissions';
import { toast } from '@/stores/toast.store';
import { useUiStore } from '@/stores/ui.store';
import type { Project, UpdateProjectInput } from '@/types';
import { startGithubLink } from '@/lib/githubLink';
import { useOnboardingMutations } from './hooks/useOnboarding';
import { InviteMembersStep } from './components/InviteMembersStep';
import { KnowledgeBaseCard } from './components/KnowledgeBaseCard';
import { LeaveSetupDialog } from './components/LeaveSetupDialog';
import { ProjectBasicsForm } from './components/ProjectBasicsForm';
import { ProjectSettingsLayout } from './components/ProjectSettingsLayout';
import { CREATE_STEPS, SETTINGS_STEPS, basicsFromProject, checkBasics, parseRepo, type ProjectBasics } from './projectBasics';
import { ReviewPolicyCard } from './components/ReviewPolicyCard';

/** 基本資訊有修改的欄位（專案代碼建立後不能修改，不送出） */
function changes(draft: ProjectBasics, project: Project): UpdateProjectInput {
  const patch: UpdateProjectInput = {};
  if (draft.name.trim() !== project.name) patch.name = draft.name.trim();
  if (draft.goal.trim() !== project.goal) patch.goal = draft.goal.trim();
  if (draft.sprintLength !== project.sprintLength) patch.sprintLength = draft.sprintLength;
  if (draft.gitIntegration !== project.gitIntegration) patch.gitIntegration = draft.gitIntegration;
  // 已連結的 repo 不能修改；未連結時送出整理過的 owner/repo（清空表示移除）。
  // 格式錯誤也算修改，儲存或切換步驟時會被表單檢查擋下並提示，不會被默默丟掉
  const repo = draft.repo.trim() ? (parseRepo(draft.repo) ?? draft.repo.trim()) : '';
  if (project.githubLinkStatus !== 'linked' && repo !== project.repo) patch.repo = repo;
  return patch;
}

/**
 * 專案設定：與建立新專案共用版面，專案建立後可以隨時回來調整。
 * 第一步「基本資訊」修改後按「儲存變更」寫回；有未儲存的修改時，切換步驟會先自動儲存。
 * 從建立新專案進來時（?setup=1）最後多一步「邀請成員」；之後要邀請改到組織與團隊設定。
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = params.get('setup') === '1';
  const steps = setup ? CREATE_STEPS : SETTINGS_STEPS;
  const { onboardingStep, setOnboardingStep } = useUiStore();
  // 從建立流程切到專案設定時，步驟數變少，超出的步驟改為最後一步
  const step = Math.min(onboardingStep, steps.length - 1);
  // 每次進入專案設定（包含從側邊欄再點一次、切換專案後再進來）都從基本資訊開始；
  // 建立流程（?setup=1）由建立頁或 GitHub 回呼決定從哪一步繼續，不重設
  const { key: visit } = useLocation();
  useLayoutEffect(() => {
    if (!setup) setOnboardingStep(0);
  }, [visit, setup, setOnboardingStep]);
  const { data: project } = useProject();
  const { data: docs } = useDocs();
  const { data: members } = useMembers();
  const { data: me } = useCurrentUser();
  const { updateProject } = useOnboardingMutations();
  const [draft, setDraft] = useState<ProjectBasics | null>(null);

  // 建立流程還沒完成就要跳到其他頁面（側邊欄、上方選單、切換專案…）時先確認；
  // 按「完成」或「取消建立」時先放行。前往 GitHub 安裝 App 是整頁跳轉，不經過這裡
  const leaving = useRef(false);
  const blocker = useBlocker(({ nextLocation }) => {
    if (!setup || leaving.current) return false;
    const stay = nextLocation.pathname === '/onboarding' && new URLSearchParams(nextLocation.search).get('setup') === '1';
    return !stay;
  });
  const leaveTo = (to: string) => {
    leaving.current = true;
    navigate(to);
  };

  // 專案載入或切換、儲存後重新讀取時，表單改為最新的專案資料
  useEffect(() => {
    if (project) setDraft(basicsFromProject(project));
  }, [project]);

  if (!project || !docs || !members || !me || !draft) return <PageSkeleton />;
  const lead = isLead(me);
  const patch = changes(draft, project);
  const dirty = lead && Object.keys(patch).length > 0;
  const valid = checkBasics(draft, 'edit').valid;

  const save = async () => {
    if (!dirty) return true;
    if (!valid) {
      toast('請確認專案名稱、專案目標與 Repository 格式');
      return false;
    }
    try {
      await updateProject.mutateAsync(patch);
      toast('已儲存專案設定');
      return true;
    } catch {
      return false;
    }
  };

  // 切換步驟前先儲存基本資訊的修改
  const go = async (i: number) => {
    if (step === 0 && !(await save())) return;
    setOnboardingStep(i);
    scrollMainToTop();
  };
  const last = step === steps.length - 1;

  return (
    <ProjectSettingsLayout
      title={setup ? '建立新專案' : '專案設定'}
      steps={steps}
      step={step}
      onStepChange={(i) => void go(i)}
      footer={
        <>
          {setup ? (
            // 建立流程：可以隨時取消建立（刪除剛建立的專案）；第一步沒有上一步
            <div className="flex gap-2">
              {lead && <CancelCreateButton project={project} onBeforeLeave={() => (leaving.current = true)} />}
              {step > 0 && <Button onClick={() => void go(step - 1)}>上一步</Button>}
            </div>
          ) : step === 0 ? (
            // 專案設定的基本資訊沒有上一步，改放刪除專案（僅 Leader）
            lead ? <DeleteProjectButton project={project} /> : <span />
          ) : (
            <Button onClick={() => void go(step - 1)}>上一步</Button>
          )}
          <div className="flex gap-2">
            {step === 0 && lead && (
              <Button onClick={() => void save()} disabled={!dirty} loading={updateProject.isPending}>
                <Save className="h-4 w-4" strokeWidth={1.75} />
                儲存變更
              </Button>
            )}
            {last ? (
              <Button variant="primary" onClick={() => leaveTo('/sprints')}>
                <Check className="h-4 w-4" strokeWidth={2} />
                完成並前往 Sprint 列表
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void go(step + 1)} loading={step === 0 && updateProject.isPending}>
                下一步
              </Button>
            )}
          </div>
        </>
      }
    >
      {step === 0 && (
        <ProjectBasicsForm
          value={draft}
          onChange={(p) => setDraft((d) => (d ? { ...d, ...p } : d))}
          mode="edit"
          editable={lead}
          project={project}
          onLink={async () => {
            // 先儲存（包含剛開啟的整合與修改過的 repo），再前往 GitHub
            if (await save()) await startGithubLink(setup ? 'onboarding' : 'settings');
          }}
        />
      )}
      {step === 1 && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {/* 所有成員都可以加入文件；Review 策略只有 Leader 可以修改 */}
          <KnowledgeBaseCard docs={docs} editable />
          <ReviewPolicyCard project={project} members={members} editable={lead} />
        </div>
      )}
      {step === 2 && <InviteMembersStep />}
      <LeaveSetupDialog
        open={blocker.state === 'blocked'}
        project={project}
        canCancel={lead}
        onStay={() => blocker.reset?.()}
        onLeave={() => blocker.proceed?.()}
        onBeforeCancel={() => {
          // 取消建立後一律回到首頁，不前往原本要去的頁面
          blocker.reset?.();
          leaving.current = true;
        }}
      />
    </ProjectSettingsLayout>
  );
}
