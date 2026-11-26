import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { onInvalidProject } from '@/lib/projectRecovery';
import { useProjectStore } from '@/stores/project.store';
import { toast } from '@/stores/toast.store';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
      }),
  );

  // 目前的專案失效（已刪除、被移出）：清掉記住的專案並重新讀取，ProjectSwitcher 會依專案清單改選第一個
  useEffect(
    () =>
      onInvalidProject(() => {
        useProjectStore.getState().setCurrentId('');
        void client.invalidateQueries();
        toast('目前的專案已不存在，或你已不是成員，已切換到其他專案');
      }),
    [client],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
