import type { DepAdvice } from '@/lib/planning';

/** 相依建議的顏色：建議延後為紅、可能延至下輪與前置未指派為橘、優先完成為藍、依序完成為灰 */
export const ADVICE_STYLE: Record<DepAdvice['kind'], string> = {
  defer: 'border-red-200 bg-red-50 text-red-700',
  next: 'border-orange-200 bg-orange-50 text-orange-700',
  wait: 'border-orange-200 bg-orange-50 text-orange-700',
  order: 'border-gray-200 bg-gray-50 text-gray-700',
  first: 'border-sky-200 bg-sky-50 text-sky-700',
};
