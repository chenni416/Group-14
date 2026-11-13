import { Button, Callout, Card, CardHeader, Label, SegmentedControl } from '@/components/ui';
import { REVIEW_MODES, REVIEW_POLICIES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import type { Member, Project, ReviewPolicy, ReviewRule } from '@/types';
import { useOnboardingMutations } from '../hooks/useOnboarding';

export function ReviewDefaultsStep({ project, members, editable }: { project: Project; members: Member[]; editable: boolean }) {
  const { updateProject } = useOnboardingMutations();
  const p = project.defaultPolicy;
  const leader = members.find((m) => m.role === 'Leader');
  const save = (policy: ReviewPolicy) =>
    editable ? updateProject.mutate({ defaultPolicy: policy }) : toast('只有 Leader / PO 可以設定');

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-3" role="radiogroup" aria-label="預設審查模式">
        {REVIEW_MODES.map((mode) => {
          const on = p.mode === mode;
          const def = REVIEW_POLICIES[mode];
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => save({ ...p, mode })}
              className={cn(
                'flex w-full items-start gap-4 rounded-3xl border bg-white p-5 text-left transition-colors duration-150',
                on ? 'border-neutral-900' : 'border-gray-100 hover:border-gray-300',
              )}
            >
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-neutral-900' : 'border-gray-300')}>
                {on && <span className="h-2.5 w-2.5 rounded-full bg-neutral-900" />}
              </span>
              <span>
                <span className="block text-base font-semibold text-gray-900">
                  {def.label} <span className="text-sm font-normal text-gray-500">{def.en}</span>
                </span>
                <span className="mt-1 block text-sm text-gray-500">適用：{def.usage}</span>
              </span>
            </button>
          );
        })}
      </div>
      <Card>
        <CardHeader title="預設設定" />
        {p.mode === 'target' ? (
          <div className="space-y-4">
            <div>
              <Label>指定審查者</Label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const on = p.targets.includes(m.id);
                  return (
                    <Button
                      key={m.id}
                      size="sm"
                      variant={on ? 'primary' : 'secondary'}
                      aria-pressed={on}
                      onClick={() => save({ ...p, targets: on ? p.targets.filter((x) => x !== m.id) : [...p.targets, m.id] })}
                    >
                      {m.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>同意門檻</Label>
              <SegmentedControl<ReviewRule>
                aria-label="同意門檻"
                value={p.rule}
                onChange={(rule) => save({ ...p, rule })}
                options={[
                  { value: 'any', label: '需 1 人同意' },
                  { value: 'all', label: '需全員同意' },
                ]}
              />
            </div>
          </div>
        ) : (
          <Callout>
            {p.mode === 'leader'
              ? `所有任務進入 In Review 時，直接通知 Leader ${leader?.name ?? ''}。`
              : '任務進入 In Review 時推送到團隊 Review 公共池，任何人可 Claim，認領後頭像才鎖定在卡片上。'}
          </Callout>
        )}
        <Callout tone="warning" className="mt-4">
          這是專案預設值。Leader 或負責人可以在單一任務上覆蓋（Task-level Override），AI 也會依任務特性建議策略。
        </Callout>
      </Card>
    </div>
  );
}
