import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TypeToConfirmDialog } from '@/components/domain/TypeToConfirmDialog';
import { Button } from '@/components/ui';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useDisclosure } from '@/hooks/useDisclosure';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import type { Project } from '@/types';

/** 專案設定「基本資訊」操作列左側的刪除專案（僅 Leader）；需輸入完整專案名稱確認 */
export function DeleteProjectButton({ project }: { project: Project }) {
  const dialog = useDisclosure();
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const remove = useApiMutation({
    mutationFn: (confirmName: string) => api.workspace.deleteProject(confirmName),
    invalidate: [],
    onSuccess: async (_, name) => {
      dialog.close();
      // 改用剩下的專案；沒有專案時首頁是歡迎頁
      setCurrentId('');
      await qc.invalidateQueries();
      navigate('/');
      toast(`已刪除「${name}」`);
    },
  });

  return (
    <>
      <Button variant="danger" onClick={dialog.open}>
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        刪除專案
      </Button>
      <TypeToConfirmDialog
        open={dialog.isOpen}
        onClose={dialog.close}
        onConfirm={() => remove.mutate(project.name)}
        title="刪除專案"
        description={<>確定要刪除「{project.name}」嗎？刪除後無法復原。</>}
        consequences={[
          '專案的 Sprint、任務、文件與回顧紀錄會一併刪除',
          '所有成員都會被移出這個專案',
          '連結的 GitHub 同步資料會刪除（repo 本身不受影響）',
        ]}
        expected={project.name}
        label={`請輸入專案名稱「${project.name}」以確認`}
        confirmLabel="刪除專案"
        loading={remove.isPending}
      />
    </>
  );
}
