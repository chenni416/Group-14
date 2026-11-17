import type { Delivery, PullRequest, Task } from '@/types';
import { REFERENCE_PATHS } from './knowledge';

/** PR 與交付資料全為 mock（不串 GitHub）：依任務編號決定性產生，重新整理後結果一致 */
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export const PR_BASE = 'https://github.com/atlab/taskline/pull';

export function mockTests(taskId: string): NonNullable<PullRequest['tests']> {
  const h = hash(taskId) % 5;
  return h === 0 ? 'none' : h === 1 ? 'failed' : 'passed';
}

export function enrichPr(task: Pick<Task, 'id' | 'domain' | 'title'>, pr: Pick<PullRequest, 'number' | 'status'>): PullRequest {
  const changedFiles = REFERENCE_PATHS[task.domain].slice(0, 3);
  return {
    ...pr,
    url: `${PR_BASE}/${pr.number}`,
    tests: mockTests(task.id),
    changedFiles,
    summary: `${task.title}：調整 ${changedFiles.length} 個檔案`,
  };
}

export function makeDelivery(
  task: Pick<Task, 'deliverables'> & { pr: PullRequest | null },
  at: string,
  extra: Partial<Pick<Delivery, 'unfinished' | 'questions'>> = {},
): Delivery {
  const tests = task.pr?.tests ?? 'none';
  return {
    prUrl: task.pr?.url ?? '',
    deliverables: task.deliverables.map((text) => ({ text, provided: true })),
    testNote: tests === 'passed' ? '本機與 CI 測試皆通過（mock）' : tests === 'failed' ? 'CI 有 1 項測試失敗，正在修正（mock）' : '尚未補上測試',
    unfinished: extra.unfinished ?? '',
    questions: extra.questions ?? '',
    submittedAt: at,
  };
}
