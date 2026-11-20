import { useCallback } from 'react';
import { toast } from '@/stores/toast.store';

export function useCopyToClipboard() {
  return useCallback(async (text: string, successMessage = '已複製') => {
    try {
      await navigator.clipboard.writeText(text);
      toast(successMessage);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      toast(ok ? successMessage : '請手動選取複製');
    }
  }, []);
}
