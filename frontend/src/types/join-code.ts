import type { MemberRole } from './member';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/** 專案目前有效的邀請碼（對應後端 schemas/join_code.py） */
export interface JoinCode {
  code: string;
  /** 經同意加入後的角色 */
  role: MemberRole;
  /** 為 null 表示不會過期 */
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateJoinCodeInput {
  role?: MemberRole;
  /** 幾天後過期；null 表示不會過期 */
  expiresInDays?: number | null;
}

/** 用邀請碼送出的加入申請 */
export interface JoinRequest {
  id: string;
  projectId: string;
  projectName: string;
  memberId: string;
  memberName: string;
  githubLogin: string;
  avatarUrl: string;
  status: JoinRequestStatus;
  createdAt: string;
}
