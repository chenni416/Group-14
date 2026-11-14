import { stripCarryNote } from '@/lib/planning';
import type { Domain } from '@/types';
import { CLARIFY_RULES, DECOMPOSE_TEMPLATES, DOMAIN_TAGS, GENERIC_AC } from '../data/knowledge';
import { createTaskRecord, db, findSprint, findTask, sprintTasks, type TaskRecord } from '../db';
import { suggestAll } from './assign';

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function guessDomain(line: string): Domain {
  if (/測試|E2E/i.test(line)) return 'QA';
  if (/設計|視覺|Figma/i.test(line)) return 'DS';
  if (/AI|模型|Prompt|RAG/i.test(line)) return 'AI';
  if (/API|後端|資料|webhook|服務|權限|推播|Email/i.test(line)) return 'BE';
  return 'FE';
}

interface SubDraft {
  title: string;
  domain: Domain;
  tags: string[];
  storyPoints: number;
  reason: string;
  slug: string;
  ac: string[];
  epic: string;
  story: string;
  source: string;
  carryTag: 'deferred' | 'multi' | null;
}

/**
 * 規則式模擬 AI 拆解：會議紀錄 → Epic / Story / Sub-task，回傳新增數量。
 * - 「[延續]」：上個 Sprint 未完成的任務會直接帶入，不重新拆解
 * - 「[延後] / [跨 Sprint]」：若對應到被延後的原任務，直接恢復原任務（保留編號、驗收條件與點數）
 * - 重新拆解時保留 Leader 調整過的任務
 * - 待釐清問題的回答會寫進相關任務的驗收條件
 */
export function decompose(sprintId: number): number {
  const sprint = findSprint(sprintId);
  const markdown = sprint.minutes;
  const goal = markdown.match(/Sprint\s*Goal\s*[：:]\s*(.+)/i)?.[1];
  if (goal && !sprint.goal) sprint.goal = goal.trim();

  const lines = markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^([-*•]|\d+[.)、])\s+/.test(l))
    .map((l) => l.replace(/^([-*•]|\d+[.)、])\s+(\[[ xX]\]\s*)?/, '').trim())
    .filter(Boolean);

  const used = new Set<number>();
  const subs: SubDraft[] = [];
  const revived: TaskRecord[] = [];

  lines.forEach((raw) => {
    if (/^\[延續\]/.test(raw)) return;
    let line = raw;
    let carryTag: SubDraft['carryTag'] = null;
    const tag = raw.match(/^\[(延後|跨 Sprint)\]\s*/);
    if (tag) {
      carryTag = tag[1] === '延後' ? 'deferred' : 'multi';
      line = stripCarryNote(raw.slice(tag[0].length));
      const item = db.backlog.find(
        (b) => b.taskId && b.usedInSprintId === sprintId && (b.text === line || b.text.replace(/^\S+-\d+\s+/, '') === line),
      );
      const original = item?.taskId ? db.tasks.find((t) => t.id === item.taskId) : undefined;
      if (original && original.state === 'DEFERRED') {
        Object.assign(original, {
          sprintId,
          state: original.origin === 'human' ? 'DRAFT' : 'AI_DRAFT',
          carryTag,
          source: line,
          revived: true,
          epic: '延續事項',
          story: original.story || '上個 Sprint 延後',
        });
        revived.push(original);
        return;
      }
    }

    const idx = DECOMPOSE_TEMPLATES.findIndex((tpl, k) => !used.has(k) && tpl.pattern.test(line));
    const tpl = DECOMPOSE_TEMPLATES[idx];
    if (tpl) {
      used.add(idx);
      tpl.subs.forEach((s) => subs.push({ ...s, epic: tpl.epic, story: tpl.story, source: line, carryTag }));
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
      epic: carryTag ? '延續事項' : '其他需求',
      story: truncate(text, 22),
      source: line,
      carryTag,
    });
  });

  // 重新拆解：只替換 Leader 沒動過的 AI 草稿
  db.tasks = db.tasks.filter((t) => !(t.sprintId === sprintId && t.state === 'AI_DRAFT' && !t.edited && !t.revived));
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
        source: s.source,
        carryTag: s.carryTag,
        origin: 'ai',
        assigneeId: db.members[0]!.id,
      }),
    );

  db.tasks.push(...created);
  suggestAll([...created, ...revived.filter((t) => !t.edited)], sprintId);

  // 套用待釐清問題的回答
  (sprint.questions ?? []).forEach((q) => {
    const rule = CLARIFY_RULES.find((r) => r.id === q.id);
    if (!rule || !q.answer) return;
    sprintTasks(sprintId)
      .filter((t) => t.state === 'AI_DRAFT' && rule.appliesTo.test(`${t.title} ${t.source}`))
      .forEach((t) => {
        const criterion = rule.criterion(q.answer);
        if (!findTask(t.id).acceptanceCriteria.includes(criterion)) {
          t.acceptanceCriteria.push(criterion);
          t.clarified = true;
        }
      });
  });
  return created.length + revived.length;
}
