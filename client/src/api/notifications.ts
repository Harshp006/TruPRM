import axios from './axios';

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  relatedEntityId?: string;
  createdAt: string;
}

export const fetchNotifications = async (unreadOnly = false, limit = 50): Promise<NotificationItem[]> => {
  const res = await axios.get(`/api/notifications?unreadOnly=${unreadOnly}&limit=${limit}`);
  return res.data;
};

export const fetchUnreadCount = async (): Promise<number> => {
  const res = await axios.get('/api/notifications/unread-count');
  return res.data.unreadCount || 0;
};

export const markNotificationRead = async (id: string): Promise<NotificationItem> => {
  const res = await axios.patch(`/api/notifications/${id}/read`);
  return res.data;
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await axios.patch('/api/notifications/read-all');
};
