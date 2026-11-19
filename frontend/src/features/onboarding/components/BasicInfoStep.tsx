import { useEffect, useState } from 'react';
import { Card, CardHeader, Field, Input, Select, SegmentedControl } from '@/components/ui';
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

  const bind = (key: 'name' | 'repo') => ({
    value: draft[key],
    disabled: !editable,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value })),
    onBlur: () => draft[key] !== project[key] && updateProject.mutate({ [key]: draft[key] }),
  });

  // 任務編號與分支由 Sprint 規劃流程依 Sprint、Story、Task 序號自動產生，兩者數字相同
  const RULE_HINT = '由 Sprint 規劃流程依 Sprint、Story、Task 序號自動產生，任務編號與分支的數字相同，方便對照查詢。';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="專案基本資訊" />
        <div className="space-y-4">
          <Field label="專案名稱" htmlFor="pj-name">
            <Input id="pj-name" {...bind('name')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="任務編號規則" htmlFor="pj-code">
              <Input id="pj-code" readOnly disabled value="S-{Sprint}{Story}{Task}" className="font-mono" />
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
            <Input id="pj-branch" readOnly disabled value="{類型}/S{Sprint}{Story}{Task}-{摘要}" className="font-mono" />
          </Field>
          <p className="-mt-2 text-xs leading-relaxed text-gray-500">
            {RULE_HINT}類型為 feat、fix、test、refactor、chore，於拆解任務時選擇。
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader title="預覽" />
        <div className="space-y-3">
          <Preview label="任務編號（Sprint 3 · 第 2 個 Story · 第 1 個 Task）">S-321</Preview>
          <Preview label="自動建議的 Branch">feat/S321-split-view</Preview>
          <Preview label="PR Webhook">
            https://taskline.app/hooks/{org.slug}/{project.provider.toLowerCase()}
          </Preview>
        </div>
      </Card>
    </div>
  );
}
