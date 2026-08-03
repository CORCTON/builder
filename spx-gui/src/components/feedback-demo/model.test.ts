import { describe, expect, it } from 'vitest'

import { createFeedbackDemoModel } from './model'

describe('feedback demo model', () => {
  it('submits feedback from the global form', () => {
    const model = createFeedbackDemoModel()

    const feedback = model.submitFeedback({
      source: 'globalForm',
      title: '  New feedback  ',
      description: '  Something went wrong.  ',
      attachments: [{ id: 'attachment-new', name: 'error.png', size: 1024 }]
    })

    expect(feedback).toMatchObject({
      source: 'globalForm',
      title: 'New feedback',
      description: 'Something went wrong.',
      status: 'new',
      userDisplayName: '小宇'
    })
    expect(model.data.feedbacks[0].id).toBe(feedback.id)
  })

  it('delivers an admin reply as one unread in-product notification', () => {
    const model = createFeedbackDemoModel()
    const newFeedback = model.data.feedbacks.find((feedback) => feedback.status === 'new')!
    const initialUnreadCount = model.unreadNotificationCount.value

    model.replyToFeedback(newFeedback.id, '  We fixed this for you.  ', [
      { id: 'reply-attachment', name: 'steps.pdf', size: 2048 }
    ])

    expect(newFeedback).toMatchObject({
      status: 'replied',
      reply: 'We fixed this for you.',
      replyAttachments: [{ id: 'reply-attachment', name: 'steps.pdf', size: 2048 }]
    })
    expect(model.data.notifications[0]).toMatchObject({
      feedbackID: newFeedback.id,
      body: 'We fixed this for you.',
      attachments: [{ id: 'reply-attachment', name: 'steps.pdf', size: 2048 }],
      readAt: null
    })
    expect(model.unreadNotificationCount.value).toBe(initialUnreadCount + 1)

    model.replyToFeedback(newFeedback.id, 'A second reply')
    expect(model.data.notifications.filter((notification) => notification.feedbackID === newFeedback.id)).toHaveLength(
      1
    )
  })

  it('marks new feedback as handled without notifying the user', () => {
    const model = createFeedbackDemoModel()
    const newFeedback = model.data.feedbacks.find((feedback) => feedback.status === 'new')!
    const initialNotificationCount = model.data.notifications.length

    model.markFeedbackHandled(newFeedback.id)

    expect(newFeedback.status).toBe('handled')
    expect(newFeedback.handledAt).not.toBeNull()
    expect(model.data.notifications).toHaveLength(initialNotificationCount)
  })

  it('marks a notification as read and restores mock data', () => {
    const model = createFeedbackDemoModel()
    const newFeedback = model.data.feedbacks.find((feedback) => feedback.status === 'new')!
    const initialUnreadCount = model.unreadNotificationCount.value
    model.replyToFeedback(newFeedback.id, 'Resolved')
    const notification = model.data.notifications[0]

    model.markNotificationRead(notification.id)
    expect(notification.readAt).not.toBeNull()
    expect(model.unreadNotificationCount.value).toBe(initialUnreadCount)

    model.reset()
    expect(model.data.feedbacks).toHaveLength(2)
    expect(model.data.notifications).toHaveLength(1)
    expect(model.data.feedbacks[0].status).toBe('new')
    expect(model.unreadNotificationCount.value).toBe(1)
  })
})
