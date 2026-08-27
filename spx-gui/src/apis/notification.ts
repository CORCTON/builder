import { client, type PaginationParams } from './common'

export type UserNotification = {
  id: string
  createdAt: string
  updatedAt: string
  title: string
  body: string
  actionPath?: string
  readAt: string | null
}

export type UserNotifications = {
  total: number
  unreadCount: number
  data: UserNotification[]
}

export function listUserNotifications(params?: PaginationParams) {
  return client.get('/user/notifications', params) as Promise<UserNotifications>
}

export function getUserNotificationUnreadCount() {
  return client.get('/user/notifications/unread-count') as Promise<Pick<UserNotifications, 'unreadCount'>>
}

export function markUserNotificationRead(notificationID: string) {
  return client.patch(`/user/notifications/${encodeURIComponent(notificationID)}`, {
    read: true
  }) as Promise<UserNotification>
}
