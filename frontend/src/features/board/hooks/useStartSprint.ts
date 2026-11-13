import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';

export function useStartSprint() {
  const navigate = useNavigate();
  return useApiMutation({
    mutationFn: api.sprints.start,
    invalidate: [['tasks'], ['sprints'], ['project'], ['notifications']],
    onSuccess: ({ carriedOver }, id) => {
      toast(`Sprint ${id} 已啟動${carriedOver ? `，${carriedOver} 項未完成任務已帶入` : ''}`);
      navigate('/board');
    },
  });
}
