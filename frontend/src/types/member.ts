export type Domain = 'FE' | 'BE' | 'AI' | 'QA' | 'DS';

export type MemberRole = 'Leader' | 'Member';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  title: string;
  domain: Domain;
  tags: string[];
  /** 每個 Sprint 可承接的 Story Points */
  capacity: number;
  /** GitHub 帳號名稱（GitHub 登入後才有） */
  githubLogin?: string | null;
  /** GitHub 頭像網址 */
  avatarUrl?: string | null;
  /** 自訂的顯示名稱；為空時 name 為 GitHub 帳號名稱 */
  displayName?: string | null;
}

/** 修改自己的帳號設定（GitHub 登入模式） */
export interface UpdateMeInput {
  /** 空字串或 null 表示恢復使用 GitHub 帳號名稱 */
  displayName: string | null;
}

export interface InviteMemberInput {
  name: string;
  email: string;
  role: MemberRole;
  title: string;
  domain: Domain;
  tags: string[];
  capacity: number;
}

export type UpdateMemberInput = Partial<Omit<Member, 'id'>>;
