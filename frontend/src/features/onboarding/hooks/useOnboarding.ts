import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';
import type { UpdateProjectInput, UploadDocInput } from '@/types';

export function useOnboardingMutations() {
  const updateProject = useApiMutation({
    mutationFn: (patch: UpdateProjectInput) => api.workspace.updateProject(patch),
    invalidate: [['project']],
  });
  const upload = useApiMutation({
    mutationFn: (files: UploadDocInput[]) => api.docs.upload(files),
    invalidate: [['docs']],
    onSuccess: (docs) => toast(`已上傳 ${docs.length} 份文件，開始建立索引`),
  });
  const addLink = useApiMutation({
    mutationFn: (url: string) => api.docs.addLink(url),
    invalidate: [['docs']],
  });
  const removeDoc = useApiMutation({ mutationFn: api.docs.remove, invalidate: [['docs']] });
  return { updateProject, upload, addLink, removeDoc };
}
