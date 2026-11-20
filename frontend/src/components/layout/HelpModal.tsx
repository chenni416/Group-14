import { Modal } from '@/components/ui';
import { ReviewPolicyList } from '@/components/domain/ReviewPolicyList';
import { StateFlow } from '@/components/domain/StateFlow';

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="系統狀態機" description="任務從會議紀錄到交付的完整流程">
      <StateFlow />
      <h3 className="mb-3 mt-6 text-sm font-semibold text-gray-900">Review 路由</h3>
      <ReviewPolicyList />
    </Modal>
  );
}
