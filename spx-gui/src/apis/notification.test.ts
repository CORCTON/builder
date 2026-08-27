import { afterEach, describe, expect, it, vi } from 'vitest'
import { client } from './common'
import { getUserNotificationUnreadCount, listUserNotifications, markUserNotificationRead } from './notification'

afterEach(() => vi.restoreAllMocks())

describe('notification APIs', () => {
  it('lists authenticated user notifications with pagination', async () => {
    const response = { total: 0, unreadCount: 0, data: [] }
    const get = vi.spyOn(client, 'get').mockResolvedValue(response)

    await expect(listUserNotifications({ pageIndex: 2, pageSize: 50 })).resolves.toBe(response)
    expect(get).toHaveBeenCalledWith('/user/notifications', { pageIndex: 2, pageSize: 50 })
  })

  it('gets the unread notification count', async () => {
    const response = { unreadCount: 3 }
    const get = vi.spyOn(client, 'get').mockResolvedValue(response)

    await expect(getUserNotificationUnreadCount()).resolves.toBe(response)
    expect(get).toHaveBeenCalledWith('/user/notifications/unread-count')
  })

  it('marks a notification as read', async () => {
    const notification = { id: '11', readAt: '2026-08-26T00:00:00Z' }
    const patch = vi.spyOn(client, 'patch').mockResolvedValue(notification)

    await expect(markUserNotificationRead('11')).resolves.toBe(notification)
    expect(patch).toHaveBeenCalledWith('/user/notifications/11', { read: true })
  })
})
