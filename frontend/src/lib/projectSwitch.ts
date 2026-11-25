/**
 * 跳頁時一併切換專案：把目標專案放在 navigation state，由 ProjectSwitcher 在抵達新頁面後才切換。
 * 這樣跳頁被擋下（例如建立流程的離開確認）時，目前的專案不會先被換掉。
 */
export interface SwitchProjectState {
  switchProject: string;
  /** 有名稱時顯示「已切換到…」提示 */
  switchName?: string;
}

export const switchProjectState = (id: string, name?: string): SwitchProjectState => ({ switchProject: id, switchName: name });

export function readSwitchProject(state: unknown): SwitchProjectState | null {
  return state && typeof state === 'object' && typeof (state as SwitchProjectState).switchProject === 'string'
    ? (state as SwitchProjectState)
    : null;
}
