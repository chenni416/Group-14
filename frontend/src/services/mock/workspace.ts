import { db, findMember, requireLead, uid } from '@/mocks/db';
import { formatSize, guessDocKind, searchKnowledge } from '@/mocks/handlers/knowledge';
import type { Invitation, JoinCode, KnowledgeDoc } from '@/types';
import { ApiError } from '@/types';
import type {
  AuthService,
  DocService,
  InvitationService,
  JoinCodeService,
  MemberService,
  WorkspaceService,
} from '../contracts';
import { respond } from './utils';
import { DEMO_PROJECTS } from '@/stores/project.store';

export const auth: AuthService = {
  me: () => respond(() => findMember(db.sessionUserId), 80),
  switchUser: (memberId) =>
    respond(() => {
      db.sessionUserId = findMember(memberId).id;
      return findMember(memberId);
    }, 80),
  // mock 成員沒有 GitHub 帳號：有輸入名稱時直接改名
  updateMe: (input) =>
    respond(() => {
      const me = findMember(db.sessionUserId);
      const name = input.displayName?.trim();
      if (name) me.name = name;
      return { ...me };
    }, 80),
};

// 示範模式的邀請：只存在記憶體，重新整理就清空；示範身分不會收到邀請
const mockInvitations: Invitation[] = [];

export const invitations: InvitationService = {
  list: () => respond(() => mockInvitations.filter((i) => i.status === 'pending')),
  create: (input) =>
    respond(() => {
      requireLead('邀請成員');
      const login = input.githubLogin.trim().replace(/^@/, '').toLowerCase();
      if (!login) throw new ApiError('請輸入 GitHub 帳號');
      const inv: Invitation = {
        id: `inv${uid()}`,
        projectId: 'taskline',
        projectName: db.project.name,
        githubLogin: login,
        role: input.role ?? 'Member',
        title: input.title ?? '',
        domain: input.domain ?? null,
        capacity: input.capacity ?? 0,
        status: 'pending',
        invitedByName: findMember(db.sessionUserId).name,
        createdAt: new Date().toISOString(),
      };
      mockInvitations.unshift(inv);
      return inv;
    }),
  revoke: (id) =>
    respond(() => {
      const inv = mockInvitations.find((i) => i.id === id);
      if (inv) inv.status = 'revoked';
    }),
  mine: () => respond(() => []),
  accept: () =>
    respond(() => {
      throw new ApiError('示範模式沒有收到的邀請');
    }),
  decline: () => respond(() => undefined),
};

// 示範模式的邀請碼：只存在記憶體；示範模式沒有別的帳號，不會有加入申請
let mockJoinCode: JoinCode | null = null;
const randomCode = () =>
  Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export const joinCodes: JoinCodeService = {
  current: () => respond(() => mockJoinCode),
  create: (input) =>
    respond(() => {
      requireLead('產生邀請碼');
      const days = input.expiresInDays === undefined ? 7 : input.expiresInDays;
      mockJoinCode = {
        code: `${db.project.prefix}-${randomCode()}`,
        role: input.role ?? 'Member',
        expiresAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
        createdAt: new Date().toISOString(),
      };
      return mockJoinCode;
    }),
  revoke: () =>
    respond(() => {
      mockJoinCode = null;
    }),
  listRequests: () => respond(() => []),
  approve: () => respond(() => undefined),
  reject: () => respond(() => undefined),
  submit: () =>
    respond(() => {
      throw new ApiError('示範模式無法用邀請碼加入，請以 GitHub 登入（./dev.sh full）');
    }),
  mine: () => respond(() => []),
  cancel: () => respond(() => undefined),
};

export const members: MemberService = {
  list: () => respond(() => db.members),
  invite: (input) =>
    respond(() => {
      requireLead('邀請成員');
      if (!input.name.trim()) throw new ApiError('請輸入姓名');
      const member = { id: `m${uid()}`, ...input, email: input.email || '—' };
      db.members.push(member);
      return member;
    }),
  update: (id, patch) =>
    respond(() => {
      requireLead('編輯成員');
      const member = findMember(id);
      if (patch.role === 'Leader') {
        db.members.forEach((m) => {
          if (m.id !== id && m.role === 'Leader') m.role = 'Member';
        });
      }
      if (patch.capacity != null) patch.capacity = Math.max(1, patch.capacity);
      Object.assign(member, patch);
      return member;
    }),
  remove: (id) =>
    respond(() => {
      requireLead('移除成員');
      const member = findMember(id);
      if (member.id === db.sessionUserId) throw new ApiError('不能把自己移出專案');
      if (member.role === 'Leader') throw new ApiError('不能移除 Leader，請先把 Leader 轉給其他成員');
      db.members = db.members.filter((m) => m.id !== id);
    }),
};

export const workspace: WorkspaceService = {
  getOrganization: () => respond(() => db.org),
  // 示範模式：側邊欄列出示意專案（不能新增）
  listProjects: () =>
    respond(() =>
      DEMO_PROJECTS.map((p) => ({ id: p.id, name: p.name, prefix: p.short, role: findMember(db.sessionUserId).role })),
    ),
  createProject: () =>
    respond(() => {
      throw new ApiError('示範模式無法建立專案，請以 GitHub 登入（./dev.sh full）');
    }),
  deleteProject: () =>
    respond(() => {
      throw new ApiError('示範模式無法刪除專案，請以 GitHub 登入（./dev.sh full）');
    }),
  getProject: () => respond(() => db.project),
  updateProject: (patch) =>
    respond(() => {
      requireLead('修改專案設定');
      if (patch.prefix != null) patch.prefix = patch.prefix.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TL';
      Object.assign(db.project, patch);
      return db.project;
    }),
};

/** 模擬後端背景索引：進度逐步增加，前端以輪詢取得最新狀態 */
function simulateIndexing(doc: KnowledgeDoc) {
  const timer = setInterval(() => {
    const target = db.docs.find((d) => d.id === doc.id);
    if (!target) return clearInterval(timer);
    target.progress = Math.min(100, target.progress + 8 + Math.floor(Math.random() * 12));
    if (target.progress >= 100) clearInterval(timer);
  }, 300);
}

function addDoc(init: Pick<KnowledgeDoc, 'name' | 'kind' | 'size' | 'isLink'>): KnowledgeDoc {
  const doc: KnowledgeDoc = { id: uid(), progress: 0, chunks: 5 + Math.floor(Math.random() * 30), ...init };
  db.docs.push(doc);
  simulateIndexing(doc);
  return doc;
}

export const docs: DocService = {
  list: () => respond(() => db.docs, 120),
  upload: (files) =>
    respond(() => files.map((f) => addDoc({ name: f.name, kind: guessDocKind(f.name), size: formatSize(f.size), isLink: false }))),
  addLink: (url) =>
    respond(() => {
      const kind = /figma/i.test(url) ? 'Figma' : /notion/i.test(url) ? 'Notion' : /github/i.test(url) ? 'README' : '連結';
      return addDoc({ name: url.replace(/^https?:\/\//, '').slice(0, 40), kind, size: '連結', isLink: true });
    }),
  remove: (id) =>
    respond(() => {
      db.docs = db.docs.filter((d) => d.id !== id);
    }),
  search: (query) => respond(() => searchKnowledge(query), 400),
};
