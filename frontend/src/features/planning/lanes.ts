import type { Tone } from '@/lib/constants';
import type { TaskState } from '@/types';

export type LaneKey = 'pending' | 'returned' | 'accepted';

/** 已送出規劃的三個追蹤狀態欄 */
export const LANES: Array<{ key: LaneKey; label: string; tone: Tone; states: TaskState[] }> = [
  { key: 'pending', label: '待確認', tone: 'orange', states: ['PENDING_MEMBER'] },
  { key: 'returned', label: '協商退回', tone: 'red', states: ['RETURNED'] },
  { key: 'accepted', label: '已接受', tone: 'sky', states: ['ASSIGNED', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] },
];

export const laneOf = (state: TaskState): LaneKey | undefined => LANES.find((l) => l.states.includes(state))?.key;
