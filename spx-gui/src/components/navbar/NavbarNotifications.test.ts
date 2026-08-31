import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserNotification } from '@/apis/notification'
import { createI18n } from '@/utils/i18n'
import NavbarNotifications from './NavbarNotifications.vue'

const mocks = vi.hoisted(() => ({
  useSignedInUser: vi.fn(),
  push: vi.fn(),
  list: vi.fn(),
  unreadCount: vi.fn(),
  markRead: vi.fn()
}))

vi.mock('@/stores/user', () => ({ useSignedInUser: mocks.useSignedInUser }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/apis/notification', () => ({
  listUserNotifications: mocks.list,
  getUserNotificationUnreadCount: mocks.unreadCount,
  markUserNotificationRead: mocks.markRead
}))
vi.mock('@/utils/exception', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/exception')>()
  return {
    ...original,
    useMessageHandle: (fn: (...args: any[]) => unknown) => ({
      fn: async (...args: any[]) => {
        try {
          await fn(...args)
        } catch {
          // Production useMessageHandle reports and consumes action failures.
        }
      },
      isLoading: ref(false)
    })
  }
})

const notification: UserNotification = {
  id: '11',
  createdAt: '2026-08-26T06:02:00Z',
  updatedAt: '2026-08-26T06:02:00Z',
  title: 'Support replied',
  body: 'Please try again.',
  actionPath: '/feedbacks/3',
  readAt: null
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const mountedWrappers: ReturnType<typeof mount>[] = []

function mountNotifications() {
  const wrapper = mount(NavbarNotifications, {
    global: {
      plugins: [createI18n({ lang: 'en' })],
      directives: { radar: () => undefined },
      stubs: {
        UIIcon: true,
        UIButton: {
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot name="icon"/><slot/></button>'
        },
        UIModal: {
          props: ['visible'],
          emits: ['update:visible'],
          template: '<div v-if="visible" role="dialog"><slot/></div>'
        }
      }
    }
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  for (const wrapper of mountedWrappers) wrapper.unmount()
  mountedWrappers.length = 0
})

describe('NavbarNotifications', () => {
  it('does not fetch or render notifications without a signed-in user', async () => {
    mocks.useSignedInUser.mockReturnValue(ref(null))

    const wrapper = mountNotifications()
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(mocks.unreadCount).not.toHaveBeenCalled()
  })

  it('refreshes the unread count when opened and when the page becomes visible', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 1 })

    const wrapper = mountNotifications()
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(1)

    await wrapper.get('[aria-label="Notifications, 1 unread"]').trigger('click')
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(3)
  })

  it('loads pages, marks a notification read, and opens its application route', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValueOnce({ unreadCount: 1 }).mockResolvedValue({ unreadCount: 0 })
    mocks.list.mockResolvedValueOnce({ nextCursor: 'next-page', data: [{ ...notification }] }).mockResolvedValueOnce({
      nextCursor: null,
      data: [
        {
          ...notification,
          id: '10',
          createdAt: '2026-08-25T06:02:00Z',
          title: 'Earlier notification',
          readAt: '2026-08-26T07:00:00Z'
        }
      ]
    })
    mocks.markRead.mockResolvedValue({ ...notification, readAt: '2026-08-26T07:01:00Z' })

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications, 1 unread"]').trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenNthCalledWith(1, { pageSize: 50 }, expect.any(AbortSignal))

    const loadMoreButton = wrapper.findAll('button').find((button) => button.text().includes('Load more'))
    expect(loadMoreButton).toBeDefined()
    await loadMoreButton!.trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenNthCalledWith(
      2,
      {
        pageSize: 50,
        cursor: 'next-page'
      },
      expect.any(AbortSignal)
    )
    expect(wrapper.text()).toContain('Earlier notification')

    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    await notificationButton!.trigger('click')
    await flushPromises()
    expect(mocks.markRead).toHaveBeenCalledWith(notification.id, expect.any(AbortSignal))
    expect(wrapper.get('[aria-label="Notifications"]').find('.absolute').exists()).toBe(false)

    const viewDetailsButton = wrapper.findAll('button').find((button) => button.text().includes('View details'))
    await viewDetailsButton!.trigger('click')
    await flushPromises()
    expect(mocks.push).toHaveBeenCalledWith(notification.actionPath)
  })

  it('does not overwrite a completed read with a stale cursor page response', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValue({ unreadCount: 1 })
    const pendingPage = deferred<{
      nextCursor: string | null
      data: (typeof notification)[]
    }>()
    mocks.list
      .mockResolvedValueOnce({ nextCursor: 'next-page', data: [{ ...notification }] })
      .mockReturnValueOnce(pendingPage.promise)
    mocks.markRead.mockResolvedValue({ ...notification, readAt: '2026-08-26T07:01:00Z' })

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications, 2 unread"]').trigger('click')
    await flushPromises()

    const loadMoreButton = wrapper.findAll('button').find((button) => button.text().includes('Load more'))
    await loadMoreButton!.trigger('click')
    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    await notificationButton!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 1 unread"]').text()).toContain('1')

    pendingPage.resolve({ nextCursor: null, data: [] })
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 1 unread"]').text()).toContain('1')
  })

  it('waits for mark-as-read and defers count refresh while the request is pending', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValue({ unreadCount: 1 })
    mocks.list.mockResolvedValue({ nextCursor: null, data: [{ ...notification }] })
    const pendingRead = deferred<typeof notification>()
    mocks.markRead.mockReturnValue(pendingRead.promise)

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications, 2 unread"]').trigger('click')
    await flushPromises()
    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    await notificationButton!.trigger('click')

    expect(wrapper.get('[aria-label="Notifications, 2 unread"]').text()).toContain('2')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(2)

    pendingRead.resolve({ ...notification, readAt: '2026-08-26T07:01:00Z' })
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(3)
    expect(wrapper.get('[aria-label="Notifications, 1 unread"]').text()).toContain('1')
  })

  it('marks different notifications as read concurrently', async () => {
    const anotherNotification = { ...notification, id: '12', title: 'Another notification' }
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValue({ unreadCount: 1 })
    mocks.list.mockResolvedValue({ nextCursor: null, data: [{ ...notification }, anotherNotification] })
    const firstRead = deferred<typeof notification>()
    const secondRead = deferred<typeof notification>()
    mocks.markRead.mockReturnValueOnce(firstRead.promise).mockReturnValueOnce(secondRead.promise)

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications, 2 unread"]').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes(notification.title))!
      .trigger('click')
    await wrapper.get('[aria-label="Back to notifications"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes(anotherNotification.title))!
      .trigger('click')

    expect(mocks.markRead).toHaveBeenCalledTimes(2)
    expect((mocks.markRead.mock.calls[0][1] as AbortSignal).aborted).toBe(false)
    expect(wrapper.text()).toContain('Marking as read...')

    secondRead.resolve({ ...anotherNotification, readAt: '2026-08-26T07:01:00Z' })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Marking as read...')
  })

  it('restarts the first page when reopened during an in-flight page request', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 0 })
    const pendingPage = deferred<{ nextCursor: string | null; data: UserNotification[] }>()
    mocks.list
      .mockResolvedValueOnce({ nextCursor: 'next-page', data: [{ ...notification }] })
      .mockReturnValueOnce(pendingPage.promise)
      .mockResolvedValueOnce({ nextCursor: null, data: [{ ...notification, title: 'Refreshed notification' }] })

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications"]').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Load more'))!
      .trigger('click')
    const pageSignal = mocks.list.mock.calls[1][1] as AbortSignal

    await wrapper.get('[aria-label="Close notifications"]').trigger('click')
    await wrapper.get('[aria-label="Notifications"]').trigger('click')
    await flushPromises()

    expect(pageSignal.aborted).toBe(true)
    expect(mocks.list).toHaveBeenCalledTimes(3)
    expect(wrapper.text()).toContain('Refreshed notification')
  })

  it('does not open an unsafe notification action', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 0 })
    mocks.list.mockResolvedValue({
      nextCursor: null,
      data: [{ ...notification, actionPath: `/\\example.com`, readAt: '2026-08-26T07:00:00Z' }]
    })

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications"]').trigger('click')
    await flushPromises()
    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    await notificationButton!.trigger('click')
    const viewDetailsButton = wrapper.findAll('button').find((button) => button.text().includes('View details'))
    await viewDetailsButton!.trigger('click')
    await flushPromises()

    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('does not let an old failed read request affect a new user session', async () => {
    const user = ref<{ id: string } | null>({ id: 'user-1' })
    const pendingRead = deferred<typeof notification>()
    mocks.useSignedInUser.mockReturnValue(user)
    mocks.unreadCount
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValueOnce({ unreadCount: 2 })
      .mockResolvedValueOnce({ unreadCount: 4 })
    mocks.list.mockResolvedValue({ nextCursor: null, data: [{ ...notification }] })
    mocks.markRead.mockReturnValue(pendingRead.promise)

    const wrapper = mountNotifications()
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 2 unread"]').text()).toContain('2')

    await wrapper.get('[aria-label="Notifications, 2 unread"]').trigger('click')
    await flushPromises()
    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    expect(notificationButton).toBeDefined()
    await notificationButton!.trigger('click')
    expect(mocks.markRead).toHaveBeenCalledWith(notification.id, expect.any(AbortSignal))

    user.value = { id: 'user-2' }
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 4 unread"]').text()).toContain('4')

    pendingRead.reject(new Error('old request failed'))
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 4 unread"]').text()).toContain('4')
  })
})
