import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';
import { useUiStore } from '@/stores/ui.store';
import type { Project } from '@/types';

/**
 * 取消建立：刪除建立流程中剛建立的專案，回到原本的專案（沒有其他專案時為歡迎頁）。
 * onBeforeLeave 在跳回首頁前呼叫，讓建立流程放行離開確認。
 */
export function useCancelCreate(project: Project, onBeforeLeave?: () => void) {
  const setCurrentId = useProjectStore((s) => s.setCurrentId);
  const setOnboardingStep = useUiStore((s) => s.setOnboardingStep);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useApiMutation({
    mutationFn: () => api.workspace.deleteProject(project.name),
    invalidate: [],
    onSuccess: async () => {
      // 清空目前的專案：側邊欄會在重新讀取清單後改選第一個專案
      setCurrentId('');
      setOnboardingStep(0);
      await qc.invalidateQueries();
      onBeforeLeave?.();
      navigate('/');
      toast(`已取消建立「${project.name}」`);
    },
  });
}
