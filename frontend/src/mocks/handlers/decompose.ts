import type { Domain } from '@/types';
import { DECOMPOSE_TEMPLATES, DOMAIN_TAGS, GENERIC_AC } from '../data/knowledge';
import { createTaskRecord, db, findSprint, sprintTasks } from '../db';
import { suggestAll } from './assign';

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function guessDomain(line: string): Domain {
  if (/測試|E2E/i.test(line)) return 'QA';
  if (/設計|視覺|Figma/i.test(line)) return 'DS';
  if (/AI|模型|Prompt|RAG/i.test(line)) return 'AI';
  if (/API|後端|資料|webhook|服務|權限/i.test(line)) return 'BE';
  return 'FE';
}

/** 規則式模擬 AI 拆解：會議紀錄 → Epic / Story / Sub-task，回傳新增數量 */
export function decompose(markdown: string): number {
  const sprintId = db.project.planningSprintId;
  const sprint = findSprint(sprintId);
  const goal = markdown.match(/Sprint\s*Goal\s*[：:]\s*(.+)/i)?.[1];
  if (goal && !sprint.goal) sprint.goal = goal.trim();

  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+[.)、])\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)、])\s+(\[[ xX]\]\s*)?/, '').trim())
    .filter(Boolean);

  const used = new Set<number>();
  const subs: Array<{
    title: string; domain: Domain; tags: string[]; storyPoints: number; reason: string;
    slug: string; ac: string[]; epic: string; story: string; source: string;
  }> = [];

  lines.forEach((line) => {
    const idx = DECOMPOSE_TEMPLATES.findIndex((tpl, k) => !used.has(k) && tpl.pattern.test(line));
    const tpl = DECOMPOSE_TEMPLATES[idx];
    if (tpl) {
      used.add(idx);
      tpl.subs.forEach((s) => subs.push({ ...s, epic: tpl.epic, story: tpl.story, source: line }));
      return;
    }
    const domain = guessDomain(line);
    const text = line.replace(/^(需要|要|希望|我們|大家)/, '').replace(/[。；;]$/, '');
    subs.push({
      title: truncate(text, 30),
      domain,
      tags: DOMAIN_TAGS[domain],
      storyPoints: 2,
      reason: '依需求描述與領域預估，建議 Leader 確認',
      slug: 'task',
      ac: [`完成「${truncate(text, 24)}」所述功能`, GENERIC_AC[domain][0]],
      epic: '其他需求',
      story: truncate(text, 22),
      source: line,
    });
  });

  // 重新拆解時移除尚未核准的 AI 草稿
  db.tasks = db.tasks.filter((t) => !(t.sprintId === sprintId && t.state === 'AI_DRAFT'));
  const existing = new Set(sprintTasks(sprintId).map((t) => t.title));

  const created = subs
    .filter((s) => !existing.has(s.title))
    .map((s) =>
      createTaskRecord(db.project, {
        id: `${db.project.prefix}-${db.seq++}`,
        sprintId,
        title: s.title,
        domain: s.domain,
        tags: [...s.tags],
        storyPoints: s.storyPoints,
        storyPointsReason: s.reason,
        acceptanceCriteria: ['成果與會議決議一致', ...s.ac].slice(0, 4),
        epic: s.epic,
        story: s.story,
        slug: s.slug,
        state: 'AI_DRAFT',
        description: `會議紀錄：「${s.source}」`,
        origin: 'ai',
        assigneeId: db.members[0]!.id,
      }),
    );

  db.tasks.push(...created);
  suggestAll(created);
  return created.length;
}
