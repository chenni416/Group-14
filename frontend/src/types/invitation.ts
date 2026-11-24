import type { Domain, MemberRole } from './member';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

/** 用 GitHub 帳號邀請成員（對應後端 schemas/invitation.py） */
export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  /** 被邀請的 GitHub 帳號（小寫） */
  githubLogin: string;
  role: MemberRole;
  title: string;
  domain: Domain | null;
  capacity: number;
  status: InvitationStatus;
  /** 邀請人的顯示名稱 */
  invitedByName: string;
  createdAt: string;
}

export interface CreateInvitationInput {
  githubLogin: string;
  role?: MemberRole;
  title?: string;
  domain?: Domain | null;
  capacity?: number;
}
