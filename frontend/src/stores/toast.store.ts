import { create } from 'zustand';

interface ToastState {
  message: string | null;
  key: number;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  message: null,
  key: 0,
  show: (message) => set((s) => ({ message, key: s.key + 1 })),
  dismiss: () => set({ message: null }),
}));

export const toast = (message: string) => useToastStore.getState().show(message);
