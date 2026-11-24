import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, GitPullRequest, Loader2, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardHeader, PageHeader } from '@/components/ui';
import { cn } from '@/lib/cn';
import { clearGithubReturn, peekGithubReturn, startGithubLink, type GithubReturn } from '@/lib/githubLink';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import { useUiStore } from '@/stores/ui.store';
import type { LinkResult } from '@/types';

type View = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'result'; result: LinkResult };

/** 讀取 GitHub 安裝完成後帶回的參數 */
function readParams() {
  const p = new URLSearchParams(window.location.search);
  const id = Number(p.get('installation_id'));
  return {
    state: p.get('state') ?? '',
    code: p.get('code'),
    installationId: Number.isFinite(id) && id > 0 ? id : null,
    setupAction: p.get('setup_action'),
  };
}

/**
 * GitHub App 安裝完成後回到這裡：後端驗證這次安裝屬於登入者，並綁定專案的 repo。
 * 結果有三種：已連結、等待 repo 擁有者核准、需要從授權的 repo 中選擇。
 */
export function GithubCallbackPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setOnboardingStep = useUiStore((s) => s.setOnboardingStep);
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [returnTo] = useState<GithubReturn>(peekGithubReturn);
  // GitHub 的授權碼只能使用一次：開發模式下 effect 會執行兩次，用 ref 確保只送出一次
  const sent = useRef(false);

  const finish = async () => {
    await qc.invalidateQueries();
    // 建立專案後繼續第二步；從專案設定發起時回到基本資訊
    setOnboardingStep(returnTo === 'onboarding' ? 1 : 0);
    navigate(returnTo === 'onboarding' ? '/onboarding?setup=1' : '/onboarding', { replace: true });
  };

  const onLinked = async (result: LinkResult) => {
    toast(`已連結 ${result.repoFullName}`);
    await finish();
  };

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    clearGithubReturn();
    const params = readParams();
    // 移除網址上的授權碼，避免重新整理時重送
    window.history.replaceState(null, '', '/github/callback');
    if (!params.state) {
      setView({ kind: 'error', message: '缺少連結資訊，請重新連結 GitHub' });
      return;
    }
    api.github
      .completeInstallation(params)
      .then((result) => (result.status === 'linked' ? onLinked(result) : setView({ kind: 'result', result })))
      .catch((err) => setView({ kind: 'error', message: err instanceof Error ? err.message : '連結失敗' }));
    // 只在進入頁面時執行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const relink = useMutation({
    mutationFn: () => startGithubLink(returnTo),
    onError: (err) => toast(err instanceof Error ? err.message : '無法前往 GitHub'),
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader eyebrow="GitHub Integration" title="連結 GitHub repo" />
      <Card className="max-w-2xl">
        {view.kind === 'loading' && (
          <p className="flex items-center gap-2 py-6 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            正在確認 GitHub 的授權並連結 repo…
          </p>
        )}

        {view.kind === 'error' && (
          <>
            <CardHeader title="連結沒有完成" description={view.message} />
            <Actions onSkip={() => void finish()} onRetry={() => relink.mutate()} retrying={relink.isPending} />
          </>
        )}

        {view.kind === 'result' && view.result.status === 'pending' && (
          <>
            <CardHeader
              title="已送出安裝請求"
              description={`你不是 ${view.result.repoFullName ?? 'repo'} 的擁有者，GitHub 已通知擁有者核准。核准後到專案設定的基本資訊按「重新連結」即可完成。`}
            />
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void finish()}>
                {returnTo === 'onboarding' ? '先繼續專案設定' : '回到專案設定'}
              </Button>
            </div>
          </>
        )}

        {view.kind === 'result' && view.result.status === 'choose_repo' && (
          <ChooseRepository result={view.result} onLinked={onLinked} onSkip={() => void finish()} onRetry={() => relink.mutate()} />
        )}
      </Card>
    </div>
  );
}

function Actions({ onSkip, onRetry, retrying }: { onSkip: () => void; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onSkip}>先略過，之後在專案設定連結</Button>
      <Button variant="primary" onClick={onRetry} loading={retrying}>
        <GitPullRequest className="h-4 w-4" strokeWidth={1.75} />
        重新連結 GitHub
      </Button>
    </div>
  );
}

/** 安裝沒有包含填寫的 repo：從 GitHub App 授權的 repo 中選擇 */
function ChooseRepository({
  result,
  onLinked,
  onSkip,
  onRetry,
}: {
  result: LinkResult;
  onLinked: (result: LinkResult) => Promise<void>;
  onSkip: () => void;
  onRetry: () => void;
}) {
  const [selected, setSelected] = useState(result.repositories[0]?.fullName ?? '');
  const choose = useMutation({
    mutationFn: () => api.github.chooseRepository(selected),
    onSuccess: onLinked,
    onError: (err) => toast(err instanceof Error ? err.message : '連結失敗'),
  });

  return (
    <>
      <CardHeader
        title="選擇要連結的 repo"
        description={
          result.repoFullName
            ? `GitHub App 沒有被授權存取 ${result.repoFullName}。請從已授權的 repo 中選擇，或重新安裝並勾選該 repo。`
            : '請從 GitHub App 已授權的 repo 中選擇一個。'
        }
      />
      {result.repositories.length === 0 ? (
        <p className="mb-5 rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">這次安裝沒有授權任何 repo</p>
      ) : (
        <ul role="radiogroup" aria-label="可以連結的 repo" className="mb-5 max-h-72 space-y-2 overflow-y-auto">
          {result.repositories.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected === r.fullName}
                onClick={() => setSelected(r.fullName)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150',
                  selected === r.fullName ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-gray-900">{r.fullName}</span>
                {r.private && <Lock className="h-4 w-4 shrink-0 text-gray-400" strokeWidth={1.75} aria-label="私人 repo" />}
                {selected === r.fullName && <Check className="h-4 w-4 shrink-0 text-gray-900" strokeWidth={2} />}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onRetry}>
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
          重新安裝並授權其他 repo
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={onSkip}>先略過</Button>
          <Button variant="primary" disabled={!selected} loading={choose.isPending} onClick={() => choose.mutate()}>
            連結這個 repo
          </Button>
        </div>
      </div>
    </>
  );
}
