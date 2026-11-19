import type { AcceptanceCheck, AcceptanceItem, AcVerdict, Task } from '@/types';

const lines = (s: string | undefined) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** 規則式模擬 AI 驗收檢查：依 mock 的 PR 資料與送審內容整理每條驗收條件的證據（純函式） */
export function aiCheck(task: Task): AcceptanceCheck {
  const pr = task.pr;
  const delivery = task.delivery;
  const files = pr?.changedFiles ?? [];
  const tests = pr?.tests ?? 'none';

  const items: AcceptanceItem[] = task.acceptanceCriteria.map((ac, i) => {
    let ai: AcVerdict = 'met';
    let evidence = `${files[i % Math.max(files.length, 1)] ?? '變更檔案'} 有對應的實作`;
    const needsTest = /測試|CI|自動|通過/.test(ac);
    if (!pr) {
      ai = 'unclear';
      evidence = '找不到 PR，無法比對';
    } else if (needsTest && tests === 'failed') {
      ai = 'mismatch';
      evidence = '測試有失敗項目，與此條件不符';
    } else if (needsTest && tests === 'none') {
      ai = 'unclear';
      evidence = '沒有測試結果可以佐證';
    } else if (i % 4 === 3) {
      ai = 'unclear';
      evidence = 'PR 中沒有找到對應的說明或畫面';
    }
    return { ac, ai, evidence, reviewer: null, note: '' };
  });

  const missing = delivery ? delivery.deliverables.filter((d) => !d.provided).map((d) => d.text) : task.deliverables;
  const allMet = items.every((i) => i.ai === 'met');
  const anyMismatch = items.some((i) => i.ai === 'mismatch');
  const goalVerdict: AcVerdict = allMet ? 'met' : anyMismatch ? 'mismatch' : 'unclear';
  const scopeVerdict: AcVerdict = missing.length || files.length > 3 ? 'unclear' : 'met';

  return {
    taskId: task.id,
    items,
    deliverablesComplete: missing.length === 0,
    missingDeliverables: missing,
    goalMatch: [
      {
        label: 'Task Goal',
        verdict: goalVerdict,
        detail: allMet ? '變更內容與任務目標一致' : anyMismatch ? '有驗收條件與測試結果不符' : '部分條件缺少證據',
      },
      {
        label: 'Scope',
        verdict: scopeVerdict,
        detail: scopeVerdict === 'met' ? '變更集中在任務範圍內' : missing.length ? '有交付物尚未提供' : '變更檔案較多，請確認沒有超出範圍',
      },
    ],
    tests,
    testSummary: tests === 'passed' ? '全部測試通過（mock 結果）' : tests === 'failed' ? '有測試失敗，建議先修正再驗收' : '沒有提供測試結果',
    unfinished: lines(delivery?.unfinished),
    questions: lines(delivery?.questions),
    changedFiles: files,
    summary: `${items.filter((i) => i.ai === 'met').length}/${items.length} 條驗收條件有證據`,
  };
}
