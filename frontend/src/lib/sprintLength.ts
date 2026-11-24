/**
 * Sprint 長度：數字加單位，存成「5 天」「2 週」這樣的文字（與後端 normalize_sprint_length 相同）。
 * 7 天以上用週表示；超過 4 週就失去短週期迭代的意義，所以不提供月。
 */
export type SprintUnit = '天' | '週';

export const SPRINT_UNITS: SprintUnit[] = ['天', '週'];
export const SPRINT_RANGES: Record<SprintUnit, [number, number]> = { 天: [1, 6], 週: [1, 4] };
export const DEFAULT_SPRINT_LENGTH = '2 週';

export function parseSprintLength(value: string): { count: number; unit: SprintUnit } {
  const m = value.trim().match(/^(\d+) (天|週)$/);
  if (!m) return { count: 2, unit: '週' };
  const unit = m[2] as SprintUnit;
  return { count: clampCount(Number(m[1]), unit), unit };
}

export function clampCount(count: number, unit: SprintUnit): number {
  const [low, high] = SPRINT_RANGES[unit];
  return Math.min(high, Math.max(low, count));
}

export const formatSprintLength = (count: number, unit: SprintUnit) => `${clampCount(count, unit)} ${unit}`;

/** 某個單位可以選的數字 */
export function sprintCounts(unit: SprintUnit): number[] {
  const [low, high] = SPRINT_RANGES[unit];
  return Array.from({ length: high - low + 1 }, (_, i) => low + i);
}
