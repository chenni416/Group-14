import type {
  AcVerdict,
  Issue,
  IssueStatus,
  IssueType,
  ProposalKind,
  ProposalStatus,
} from '@/types';
import type { Tone } from './constants';

/** G4：問題與提案的標籤與規則 */
export const ISSUE_TYPES: Record<IssueType, { label: string; hint: string }> = {
  tech: { label: '技術困難', hint: '卡在實作方式、環境或工具' },
  dependency: { label: '前置依賴', hint: '需要別人的成果才能繼續' },
  schedule: { label: '時程問題', hint: '預估不足或被其他事情占用' },
  other: { label: '其他', hint: '不屬於以上類型' },
};

export const ISSUE_STATUS: Record<IssueStatus, { label: string; tone: Tone }> = {
  reported: { label: '已回報', tone: 'red' },
  assigned: { label: '已指派', tone: 'orange' },
  responded: { label: '已回應', tone: 'violet' },
  resolved: { label: '已解決', tone: 'sky' },
  replan: { label: '需重新規劃', tone: 'dark' },
};

/** 尚未結案的問題（仍會阻礙任務） */
export const isOpenIssue = (i: Pick<Issue, 'status'>) => i.status !== 'resolved' && i.status !== 'replan';

/** 超過這麼多小時沒有回應就提醒處理人與 Leader */
export const ISSUE_STALE_HOURS = 24;

export const hoursSince = (iso: string, now = Date.now()) => Math.floor((now - new Date(iso).getTime()) / 3_600_000);

export const isStale = (i: Issue, now = Date.now()) =>
  (i.status === 'reported' || i.status === 'assigned') && hoursSince(i.updatedAt, now) >= ISSUE_STALE_HOURS;

export const PROPOSAL_KINDS: Record<ProposalKind, string> = {
  idea: '新想法',
  improve: '改善建議',
  change: '需求變更',
};

export const PROPOSAL_STATUS: Record<ProposalStatus, { label: string; tone: Tone }> = {
  open: { label: '待決策', tone: 'orange' },
  adopted: { label: '已採納', tone: 'sky' },
  rejected: { label: '不採納', tone: 'neutral' },
  nextSprint: { label: '納入下一個 Sprint', tone: 'violet' },
};

export const AC_VERDICT: Record<AcVerdict, { label: string; tone: Tone }> = {
  met: { label: '已滿足', tone: 'sky' },
  unclear: { label: '未確認', tone: 'orange' },
  mismatch: { label: '可能不符', tone: 'red' },
};

export const TEST_STATUS = {
  passed: { label: '測試通過', tone: 'sky' as Tone },
  failed: { label: '測試失敗', tone: 'red' as Tone },
  none: { label: '沒有測試結果', tone: 'neutral' as Tone },
};
