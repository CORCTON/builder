import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const notification = {
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

function mountNotifications() {
  return mount(NavbarNotifications, {
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
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('NavbarNotifications', () => {
  it('does not fetch or render notifications without a signed-in user', async () => {
    mocks.useSignedInUser.mockReturnValue(ref(null))

    const wrapper = mountNotifications()
    await flushPromises()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(mocks.unreadCount).not.toHaveBeenCalled()
  })

  it('refreshes the unread count periodically and when the page becomes visible', async () => {
    vi.useFakeTimers()
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 1 })

    const wrapper = mountNotifications()
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(mocks.unreadCount).toHaveBeenCalledTimes(2)

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(mocks.unreadCount).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('loads pages, marks a notification read, and opens its application route', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 1 })
    mocks.list.mockResolvedValueOnce({ total: 2, unreadCount: 1, data: [{ ...notification }] }).mockResolvedValueOnce({
      total: 2,
      unreadCount: 1,
      data: [{ ...notification, id: '12', title: 'Earlier notification', readAt: '2026-08-26T07:00:00Z' }]
    })
    mocks.markRead.mockResolvedValue({ ...notification, readAt: '2026-08-26T07:01:00Z' })

    const wrapper = mountNotifications()
    await flushPromises()
    await wrapper.get('[aria-label="Notifications, 1 unread"]').trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenNthCalledWith(1, { pageIndex: 1, pageSize: 50 })

    const loadMoreButton = wrapper.findAll('button').find((button) => button.text().includes('Load more'))
    expect(loadMoreButton).toBeDefined()
    await loadMoreButton!.trigger('click')
    await flushPromises()
    expect(mocks.list).toHaveBeenNthCalledWith(2, { pageIndex: 2, pageSize: 50 })
    expect(wrapper.text()).toContain('Earlier notification')

    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    await notificationButton!.trigger('click')
    await flushPromises()
    expect(mocks.markRead).toHaveBeenCalledWith(notification.id)
    expect(wrapper.get('[aria-label="Notifications"]').find('.absolute').exists()).toBe(false)

    const viewDetailsButton = wrapper.findAll('button').find((button) => button.text().includes('View details'))
    await viewDetailsButton!.trigger('click')
    await flushPromises()
    expect(mocks.push).toHaveBeenCalledWith(notification.actionPath)
  })

  it('does not overwrite an optimistic unread count with a stale page response', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 2 })
    const pendingPage = deferred<{ total: number; unreadCount: number; data: (typeof notification)[] }>()
    mocks.list
      .mockResolvedValueOnce({ total: 2, unreadCount: 2, data: [{ ...notification }] })
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

    pendingPage.resolve({ total: 2, unreadCount: 2, data: [] })
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 1 unread"]').text()).toContain('1')
  })

  it('does not open an unsafe notification action', async () => {
    mocks.useSignedInUser.mockReturnValue(ref({ id: 'user-1' }))
    mocks.unreadCount.mockResolvedValue({ unreadCount: 0 })
    mocks.list.mockResolvedValue({
      total: 1,
      unreadCount: 0,
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

  it('does not roll an old failed read request back into a new user session', async () => {
    const user = ref<{ id: string } | null>({ id: 'user-1' })
    const pendingRead = deferred<typeof notification>()
    mocks.useSignedInUser.mockReturnValue(user)
    mocks.unreadCount.mockResolvedValueOnce({ unreadCount: 2 }).mockResolvedValueOnce({ unreadCount: 4 })
    mocks.list.mockResolvedValue({ total: 1, unreadCount: 2, data: [{ ...notification }] })
    mocks.markRead.mockReturnValue(pendingRead.promise)

    const wrapper = mountNotifications()
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 2 unread"]').text()).toContain('2')

    await wrapper.get('[aria-label="Notifications, 2 unread"]').trigger('click')
    await flushPromises()
    const notificationButton = wrapper.findAll('button').find((button) => button.text().includes(notification.title))
    expect(notificationButton).toBeDefined()
    await notificationButton!.trigger('click')
    expect(mocks.markRead).toHaveBeenCalledWith(notification.id)

    user.value = { id: 'user-2' }
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 4 unread"]').text()).toContain('4')

    pendingRead.reject(new Error('old request failed'))
    await flushPromises()
    expect(wrapper.get('[aria-label="Notifications, 4 unread"]').text()).toContain('4')
  })
})
