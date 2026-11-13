export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const minutes = (now - new Date(iso).getTime()) / 60_000;
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${Math.round(minutes)} 分鐘前`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const mention = (name: string | undefined) => `@${name ?? '未知成員'}`;
