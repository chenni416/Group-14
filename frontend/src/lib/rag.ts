import type { KnowledgeDoc } from '@/types';
import { sum } from './format';

/** 知識庫索引狀態摘要 */
export function ragStatus(docs: KnowledgeDoc[]) {
  const indexing = docs.filter((d) => d.progress < 100).length;
  return indexing
    ? { ready: false, label: `Indexing ${docs.length - indexing}/${docs.length} files` }
    : { ready: true, label: `RAG Ready · ${sum(docs.map((d) => d.chunks))} chunks` };
}
