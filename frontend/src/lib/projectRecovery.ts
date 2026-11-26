/**
 * 目前專案失效時的自動復原。
 *
 * 後端對 X-Project-Id 不再「偷偷改用別的專案」：專案已刪除、我已被移出時回 403 PROJECT_ACCESS_DENIED，
 * id 格式不正確時回 400 INVALID_PROJECT_ID。前端收到這兩個錯誤時，清掉目前的專案、重新讀取所有資料，
 * 並提示使用者；之後 ProjectSwitcher 會依專案清單改選第一個專案。
 */

/** 後端回報「目前的專案無效」的錯誤碼 */
export const INVALID_PROJECT_CODES: readonly string[] = ['PROJECT_ACCESS_DENIED', 'INVALID_PROJECT_ID'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 真實專案的 id 是 uuid。示範專案（例如預設的 'taskline'）與空字串不是，不應該送給後端：
 * 沒有送 X-Project-Id 時，後端使用最近加入的專案。
 */
export const isRealProjectId = (id: string | null | undefined): id is string => !!id && UUID.test(id);

let listener: (() => void) | null = null;
let cooling = false;

/** 註冊「目前專案失效」的處理（由 AppProviders 設定）；回傳取消註冊的函式 */
export function onInvalidProject(fn: () => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

/** 同時有多個請求因為同一個失效的專案而失敗時，只處理一次 */
export function reportInvalidProject(): void {
  if (cooling || !listener) return;
  cooling = true;
  setTimeout(() => {
    cooling = false;
  }, 3000);
  listener();
}
