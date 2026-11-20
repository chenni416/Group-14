import { useNavigate } from 'react-router-dom';
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/services';
import { toast } from '@/stores/toast.store';

export function useStartSprint() {
  const navigate = useNavigate();
  return useApiMutation({
    mutationFn: api.sprints.start,
    invalidate: [['tasks'], ['sprints'], ['project'], ['notifications'], ['backlog']],
    onSuccess: ({ carriedOver, deferred }, id) => {
      toast(`Sprint ${id} 已啟動${carriedOver ? `，帶入 ${carriedOver} 項未完成任務` : ''}${deferred ? `，${deferred} 項延後` : ''}`);
      navigate('/board');
    },
  });
}
