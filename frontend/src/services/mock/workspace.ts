import { db, findMember, requireLead, uid } from '@/mocks/db';
import { formatSize, guessDocKind, searchKnowledge } from '@/mocks/handlers/knowledge';
import type { KnowledgeDoc } from '@/types';
import { ApiError } from '@/types';
import type { AuthService, DocService, MemberService, WorkspaceService } from '../contracts';
import { respond } from './utils';

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
};

export const workspace: WorkspaceService = {
  getOrganization: () => respond(() => db.org),
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
