import { KB_SNIPPETS, REFERENCE_PATHS, TECH_LIMITS } from '../data/knowledge';
import { db, findSprint, type TaskRecord } from '../db';

/** 組合給 Coding Agent 的 Prompt（任務規格 + Sprint 目標 + 知識庫） */
export function buildPrompt(task: TaskRecord, version: number): string[] {
  const clarifications = task.clarifications[version] ?? [];
  const sprint = findSprint(task.sprintId);
  return [
    '你現在是這項任務的執行者。',
    `【專案】${db.project.name}（${db.project.repo}）`,
    `【Sprint 目標】${sprint.goal || '（尚未設定）'}`,
    `【任務背景】${KB_SNIPPETS[task.domain]}`,
    `【目標】${task.id} ${task.title}`,
    '【驗收條件】',
    ...task.acceptanceCriteria.map((a, i) => `${i + 1}. ${a}`),
    `【技術限制】${TECH_LIMITS[task.domain]}`,
    `【參考檔案】${REFERENCE_PATHS[task.domain].join('、')}`,
    `【Branch】${task.branch}`,
    ...(clarifications.length ? ['【補充釐清】', ...clarifications.map((c) => `- ${c}`)] : []),
    '完成後請列出修改的檔案，並說明如何驗證每一條驗收條件。',
  ];
}
