/** 任務留言區：單層留言串，可 @ 標注成員 */
export interface TaskComment {
  id: string;
  taskId: string;
  byId: string;
  text: string;
  /** 被 @ 標注的成員 id */
  mentions: string[];
  at: string;
}

export interface AddCommentInput {
  text: string;
  mentions: string[];
}
