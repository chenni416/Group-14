import { REVIEW_MODES, REVIEW_POLICIES } from '@/lib/constants';

export function ReviewPolicyList() {
  return (
    <div className="space-y-2">
      {REVIEW_MODES.map((k) => {
        const p = REVIEW_POLICIES[k];
        return (
          <div key={k} className="rounded-2xl bg-gray-50 px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium text-gray-900">{p.label}</span>
              <span className="text-xs text-gray-500">{p.en}</span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">{p.usage}</p>
          </div>
        );
      })}
    </div>
  );
}
