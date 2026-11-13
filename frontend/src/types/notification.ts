export type NotificationType = 'invite' | 'review' | 'pool' | 'returned' | 'info';

export interface Notification {
  id: string;
  toId: string;
  fromId: string;
  type: NotificationType;
  taskId: string;
  text: string;
  createdAt: string;
  status: 'pending' | 'done';
}
