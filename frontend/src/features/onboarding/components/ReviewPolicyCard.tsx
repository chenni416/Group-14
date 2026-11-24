import { Button, Card, CardHeader, Label, SegmentedControl } from '@/components/ui';
import { REVIEW_MODES, REVIEW_POLICIES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import type { Member, Project, ReviewPolicy, ReviewRule } from '@/types';
import { useOnboardingMutations } from '../hooks/useOnboarding';

/** Review 預設策略：選擇模式後立即儲存；指定審查者模式可以選人與同意門檻 */
export function ReviewPolicyCard({ project, members, editable }: { project: Project; members: Member[]; editable: boolean }) {
  const { updateProject } = useOnboardingMutations();
  const p = project.defaultPolicy;
  const leader = members.find((m) => m.role === 'Leader');
  const save = (policy: ReviewPolicy) =>
    editable ? updateProject.mutate({ defaultPolicy: policy }) : toast('只有 Leader 可以設定');

  return (
    <Card>
      <CardHeader title="Review 預設策略" description="專案預設值；單一任務可以覆蓋，AI 也會依任務特性建議策略" />
      <div className="space-y-2" role="radiogroup" aria-label="預設審查模式">
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
                'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors duration-150',
                on ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50',
              )}
            >
              <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', on ? 'border-neutral-900' : 'border-gray-300')}>
                {on && <span className="h-2 w-2 rounded-full bg-neutral-900" />}
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {def.label} <span className="font-normal text-gray-500">{def.en}</span>
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">適用：{def.usage}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {p.mode === 'target' ? (
          <div className="space-y-3">
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
          <p className="text-sm text-gray-500">
            {p.mode === 'leader'
              ? `所有任務進入 In Review 時，直接通知 Leader ${leader?.name ?? ''}。`
              : '任務進入 In Review 時推送到團隊 Review 公共池，任何人可以認領，認領後頭像才鎖定在卡片上。'}
          </p>
        )}
      </div>
    </Card>
  );
}
