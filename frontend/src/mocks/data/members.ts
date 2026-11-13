import type { Member } from '@/types';

export const seedMembers = (): Member[] => [
  { id: 'm1', name: '陳怡君', email: 'yijun@atlab.tw', role: 'Leader', title: 'Frontend Lead', domain: 'FE', tags: ['React', 'TypeScript', 'Tailwind', 'Figma'], capacity: 8 },
  { id: 'm2', name: '林柏翰', email: 'bohan@atlab.tw', role: 'Member', title: 'Backend Engineer', domain: 'BE', tags: ['Python', 'FastAPI', 'PostgreSQL', 'Docker'], capacity: 10 },
  { id: 'm3', name: '王思妤', email: 'szuyu@atlab.tw', role: 'Member', title: 'AI Engineer', domain: 'AI', tags: ['LLM', 'RAG', 'Python', 'LangChain'], capacity: 8 },
  { id: 'm4', name: '張家豪', email: 'chiahao@atlab.tw', role: 'Member', title: 'QA / DevOps', domain: 'QA', tags: ['Playwright', 'GitHub Actions', 'Docker', 'Vitest'], capacity: 8 },
  { id: 'm5', name: '李雅婷', email: 'yating@atlab.tw', role: 'PO', title: 'Product Designer', domain: 'DS', tags: ['Figma', 'UX Research', 'Design System', 'React'], capacity: 6 },
];
