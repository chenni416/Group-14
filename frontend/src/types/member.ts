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
