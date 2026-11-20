import type { SearchHit } from '@/types';

/** 模擬 RAG 檢索 */
export function searchKnowledge(query: string): SearchHit[] {
  const hits: SearchHit[] = [];
  if (/webhook|驗證|簽章|API|JWT/i.test(query))
    hits.push({ source: 'openapi.yaml', excerpt: '§webhooks：驗證 X-Hub-Signature-256（HMAC SHA-256），失敗回傳 401。', score: 0.92 });
  if (/測試|CI|test/i.test(query))
    hits.push({ source: 'README.md', excerpt: '§CI：PR 觸發 lint + unit + e2e，E2E 使用 Playwright。', score: 0.88 });
  if (/UI|設計|樣式|Figma/i.test(query))
    hits.push({ source: 'Figma · Taskline UI Kit v2', excerpt: '卡片圓角 16/24px，主色 #111827。', score: 0.85 });
  if (!hits.length)
    hits.push({ source: 'PRD_v2.md', excerpt: '§1 產品目標：讓會議決議自動轉為可追蹤、可交付的任務。', score: 0.61 });
  hits.push({ source: 'CODING_STANDARDS.md', excerpt: '§2 命名與資料夾結構規範。', score: 0.54 });
  return hits.slice(0, 3);
}

export const guessDocKind = (name: string) =>
  /prd/i.test(name) ? 'PRD'
  : /api|openapi|swagger/i.test(name) ? 'API 規格'
  : /readme/i.test(name) ? 'README'
  : /standard|style|lint/i.test(name) ? 'Coding Standards'
  : /png|jpg|svg|drawio|arch|架構/i.test(name) ? '架構圖'
  : '文件';

export const formatSize = (bytes: number) =>
  bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
