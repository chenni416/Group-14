import { Select, SegmentedControl } from '@/components/ui';
import { REVIEW_MODES, REVIEW_POLICIES } from '@/lib/constants';
import { cn } from '@/lib/cn';
import { reviewerText } from '@/lib/planning';
import type { Member, ReviewMode, ReviewPolicy, ReviewRule } from '@/types';

interface Props {
  id: string;
  value: ReviewPolicy;
  onChange: (policy: ReviewPolicy) => void;
  members: Member[];
  /** 負責人不能審查自己的任務 */
  assigneeId?: string;
  leaderName?: string;
}

/** Review 策略與審查人員（任務卡、新增任務共用） */
export function ReviewPolicyEditor({ id, value, onChange, members, assigneeId, leaderName }: Props) {
  const names = new Map(members.map((m) => [m.id, m.name]));
  const toggle = (memberId: string) =>
    onChange({
      ...value,
      targets: value.targets.includes(memberId) ? value.targets.filter((x) => x !== memberId) : [...value.targets, memberId],
    });

  return (
    <div className="space-y-2">
      <Select
        id={id}
        aria-label="Review 策略"
        value={value.mode}
        onChange={(e) => {
          const mode = e.target.value as ReviewMode;
          onChange({ mode, targets: mode === 'target' ? value.targets : [], rule: value.rule });
        }}
      >
        {REVIEW_MODES.map((m) => (
          <option key={m} value={m}>
            {REVIEW_POLICIES[m].label}
          </option>
        ))}
      </Select>
      {value.mode === 'target' && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="指定審查人員">
            {members
              .filter((m) => m.id !== assigneeId)
              .map((m) => {
                const on = value.targets.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(m.id)}
                    className={cn(
                      'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      on ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {m.name}
                  </button>
                );
              })}
          </div>
          <SegmentedControl<ReviewRule>
            size="sm"
            aria-label="同意門檻"
            value={value.rule}
            onChange={(rule) => onChange({ ...value, rule })}
            options={[
              { value: 'any', label: '需 1 人同意' },
              { value: 'all', label: '需全員同意' },
            ]}
          />
        </>
      )}
      <p className="text-xs text-gray-600">{reviewerText(value, names, leaderName)}</p>
    </div>
  );
}
