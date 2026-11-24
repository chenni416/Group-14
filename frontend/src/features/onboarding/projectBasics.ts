import type { Project } from '@/types';

/** 專案設定的步驟 */
export const SETTINGS_STEPS = ['基本資訊', '知識庫與 Review 策略'];
/** 建立新專案的步驟：最後多一步邀請成員（之後要邀請改到組織與團隊設定） */
export const CREATE_STEPS = [...SETTINGS_STEPS, '邀請成員'];

export interface ProjectBasics {
  name: string;
  prefix: string;
  goal: string;
  sprintLength: string;
  gitIntegration: boolean;
  /** GitHub repo；設定模式帶入已存的 repo，已連結時不能修改 */
  repo: string;
}

/** 專案代碼只保留英文大寫與數字（與後端相同） */
export const toPrefix = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

/** GitHub repo：https://github.com/owner/repo、github.com/owner/repo 或 owner/repo（與後端相同） */
const REPO_PATTERN = /^(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)?([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;
export function parseRepo(value: string): string | null {
  const m = value.trim().match(REPO_PATTERN);
  return m && m[2] !== '.' && m[2] !== '..' ? `${m[1]}/${m[2]}` : null;
}

export function basicsFromProject(project: Project): ProjectBasics {
  // 已存的 repo 可能是 owner/repo 或完整網址，統一整理後顯示成完整網址
  const repo = project.repo ? (parseRepo(project.repo) ?? project.repo) : '';
  return {
    name: project.name,
    prefix: project.prefix,
    goal: project.goal,
    sprintLength: project.sprintLength,
    gitIntegration: project.gitIntegration,
    repo: project.githubRepoUrl || (repo ? `https://github.com/${repo}` : ''),
  };
}

/** 表單檢查：repo 有填就要是正確格式；建立模式整合 GitHub 時 repo 必填 */
export function checkBasics(value: ProjectBasics, mode: 'create' | 'edit') {
  const repoInvalid = value.repo.trim() !== '' && parseRepo(value.repo) === null;
  const repoMissing = mode === 'create' && value.gitIntegration && value.repo.trim() === '';
  const complete = value.name.trim() !== '' && value.prefix !== '' && value.goal.trim() !== '';
  return { repoInvalid, repoMissing, valid: complete && !repoInvalid && !repoMissing };
}
