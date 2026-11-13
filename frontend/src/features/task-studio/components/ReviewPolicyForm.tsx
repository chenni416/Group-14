import { Button, Callout, Card, CardHeader, SegmentedControl } from '@/components/ui';
import { REVIEW_MODES, REVIEW_POLICIES } from '@/lib/constants';
import { canEditPolicy } from '@/lib/permissions';
import { useTaskActions } from '@/hooks/useTaskActions';
import type { Member, ReviewMode, ReviewPolicy, ReviewRule, Task } from '@/types';

export function ReviewPolicyForm({ task, user, members }: { task: Task; user: Member | undefined; members: Member[] }) {
  const { updatePolicy } = useTaskActions();
  const editable = canEditPolicy(task, user);
  const p = task.policy;
  const save = (policy: ReviewPolicy) => updatePolicy.mutate({ id: task.id, policy });

  return (
    <Card className="p-5">
      <CardHeader
        title="Review Policy"
        description={editable ? 'Task-level Override' : '審查中或無權限，已鎖定'}
        className="mb-4"
      />
      <SegmentedControl<ReviewMode>
        size="sm"
        aria-label="審查模式"
        value={p.mode}
        onChange={(mode) => save({ mode, targets: mode === 'target' ? p.targets : [], rule: p.rule })}
        options={REVIEW_MODES.map((m) => ({ value: m, label: REVIEW_POLICIES[m].label, disabled: !editable }))}
      />
      <p className="mt-3 text-sm text-gray-500">
        {REVIEW_POLICIES[p.mode].en} · 適用：{REVIEW_POLICIES[p.mode].usage}
      </p>
      {p.mode === 'target' && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {members
              .filter((m) => m.id !== task.assigneeId)
              .map((m) => {
                const on = p.targets.includes(m.id);
                return (
                  <Button
                    key={m.id}
                    size="xs"
                    variant={on ? 'primary' : 'secondary'}
                    disabled={!editable}
                    aria-pressed={on}
                    onClick={() =>
                      save({ ...p, targets: on ? p.targets.filter((x) => x !== m.id) : [...p.targets, m.id] })
                    }
                  >
                    {m.name} · {m.title}
                  </Button>
                );
              })}
          </div>
          <SegmentedControl<ReviewRule>
            size="sm"
            aria-label="同意門檻"
            value={p.rule}
            onChange={(rule) => save({ ...p, rule })}
            options={[
              { value: 'any', label: '需 1 人同意', disabled: !editable },
              { value: 'all', label: '需全員同意', disabled: !editable },
            ]}
          />
        </div>
      )}
      {task.policyReason && (
        <Callout tone="ai" title="AI 建議" className="mt-4">
          {task.policyReason}
        </Callout>
      )}
    </Card>
  );
}
