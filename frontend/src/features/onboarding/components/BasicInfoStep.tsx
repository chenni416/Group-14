import { useEffect, useState } from 'react';
import { Card, CardHeader, Field, Input, Select, SegmentedControl, Textarea } from '@/components/ui';
import type { GitProvider, Organization, Project } from '@/types';
import { useOnboardingMutations } from '../hooks/useOnboarding';

function Preview({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-4 py-3">
      <div className="mb-1 text-xs text-gray-500">{label}</div>
      <div className="break-all font-mono text-sm text-gray-900">{children}</div>
    </div>
  );
}

export function BasicInfoStep({ project, org, editable }: { project: Project; org: Organization; editable: boolean }) {
  const { updateProject } = useOnboardingMutations();
  const [draft, setDraft] = useState(project);
  useEffect(() => setDraft(project), [project]);

  const bind = (key: 'name' | 'prefix' | 'repo' | 'branchPattern') => ({
    value: draft[key],
    disabled: !editable,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    onBlur: () => draft[key] !== project[key] && updateProject.mutate({ [key]: draft[key] }),
  });

  const branch = project.branchPattern
    .replace('{prefix}', project.prefix.toLowerCase())
    .replace('{id}', '301')
    .replace('{slug}', 'split-view');

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="專案基本資訊" />
        <div className="space-y-4">
          <Field label="專案名稱" htmlFor="pj-name">
            <Input id="pj-name" {...bind('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="代碼前綴" htmlFor="pj-prefix">
              <Input id="pj-prefix" maxLength={6} className="font-mono uppercase" {...bind('prefix')} />
            </Field>
            <Field label="Sprint 長度" htmlFor="pj-len">
              <Select
                id="pj-len"
                value={project.sprintLength}
                disabled={!editable}
                onChange={(e) => updateProject.mutate({ sprintLength: e.target.value })}
              >
                {['1 週', '2 週', '3 週'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Project Goal（專案目標，必填）" htmlFor="pj-goal">
            <Textarea
              id="pj-goal"
              rows={3}
              value={draft.goal}
              disabled={!editable}
              placeholder="這個專案最終要達成什麼？會顯示在 Sprint 總覽與 Dashboard。"
              onChange={(e) => setDraft((d) => ({ ...d, goal: e.target.value }))}
              onBlur={() => draft.goal.trim() && draft.goal !== project.goal && updateProject.mutate({ goal: draft.goal.trim() })}
              aria-invalid={!draft.goal.trim()}
            />
            {!draft.goal.trim() && <p className="mt-1 text-xs text-red-600">請填寫專案目標</p>}
          </Field>
          <Field label="Repository" htmlFor="pj-repo">
            <div className="flex flex-col gap-2 sm:flex-row">
              <SegmentedControl<GitProvider>
                aria-label="Git 平台"
                value={project.provider}
                onChange={(provider) => updateProject.mutate({ provider })}
                options={(['GitHub', 'GitLab'] as const).map((v) => ({ value: v, label: v, disabled: !editable }))}
                className="shrink-0 flex-nowrap"
              />
              <Input id="pj-repo" {...bind('repo')} />
            </div>
          </Field>
          <Field label="Branch 命名規則" htmlFor="pj-branch">
            <Input id="pj-branch" className="font-mono" {...bind('branchPattern')} />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="預覽" />
        <div className="space-y-3">
          <Preview label="任務編號">{project.prefix}-301</Preview>
          <Preview label="自動建議的 Branch">{branch}</Preview>
          <Preview label="PR Webhook">
            https://taskline.app/hooks/{org.slug}/{project.provider.toLowerCase()}
          </Preview>
        </div>
      </Card>
    </div>
  );
}
