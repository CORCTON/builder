<script setup lang="ts">
import { computed, nextTick, onScopeDispose, ref, useId, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useI18n } from '@/utils/i18n'
import { UIButton, UIFormModal, UIIcon, UIModal, UIModalClose, useMessage } from '@/components/ui'
import { useCopilot } from '@/components/copilot/context'
import { RoundState } from '@/components/copilot/copilot'
import { useEditorCtxRef } from '@/components/editor/EditorContextProvider.vue'
import { useCodeEditorRef } from '@/components/xgo-code-editor'
import { createPrepareFeedbackTool, type PreparedFeedbackDraft } from './copilot'
import { captureFeedbackContext } from './context'
import FeedbackForm from './FeedbackForm.vue'
import { useFeedbackDemoModel, type SubmitFeedbackInput } from './model'
import type { FeedbackAttachment, InProductNotification } from './mock-data'
import { captureViewport } from '@/components/screenshot/capture'

const model = useFeedbackDemoModel()
const notificationPageSize = 5
const copilot = useCopilot()
const i18n = useI18n()
const { t } = i18n
const message = useMessage()
const route = useRoute()
const editorCtxRef = useEditorCtxRef()
const codeEditorRef = useCodeEditorRef()
const isSubmitting = ref(false)
const activeSubmission = ref<symbol | null>(null)
const pendingCopilotFeedback = ref<PreparedFeedbackDraft | null>(null)
const selectedNotificationID = ref<string | null>(null)
const visibleNotificationCount = ref(notificationPageSize)
const notificationTitleID = useId()
const imagePreviewTitleID = useId()
type RenderableFeedbackAttachment = FeedbackAttachment & { url: string }
const selectedPreviewAttachment = ref<RenderableFeedbackAttachment | null>(null)
const visibleNotifications = computed(() => model.data.notifications.slice(0, visibleNotificationCount.value))
const selectedNotification = computed(
  () => model.data.notifications.find((notification) => notification.id === selectedNotificationID.value) ?? null
)
const selectedNotificationFeedback = computed(() => {
  const notification = selectedNotification.value
  return notification == null
    ? null
    : model.data.feedbacks.find((feedback) => feedback.id === notification.feedbackID) ?? null
})
const notificationImageAttachmentsMap = computed(() => {
  const attachmentsMap = new Map<string, RenderableFeedbackAttachment[]>()
  for (const feedback of model.data.feedbacks) {
    attachmentsMap.set(feedback.id, feedback.attachments.filter(isRenderableImageAttachment))
  }
  return attachmentsMap
})
const selectedNotificationImageAttachments = computed(
  () => notificationImageAttachmentsMap.value.get(selectedNotification.value?.feedbackID ?? '') ?? []
)

onScopeDispose(
  copilot.registerTool(
    createPrepareFeedbackTool((draft) => {
      pendingCopilotFeedback.value = draft
    })
  )
)

watch(
  () => copilot.currentSession?.currentRound?.state ?? null,
  (state) => {
    if (state === RoundState.Completed && pendingCopilotFeedback.value != null) {
      const draft = pendingCopilotFeedback.value
      pendingCopilotFeedback.value = null
      model.openFeedbackForm('globalForm', draft)
      return
    }
    if (state === RoundState.Cancelled || state === RoundState.Failed) pendingCopilotFeedback.value = null
  }
)

watch(model.activeFormSource, (source, previousSource) => {
  if (source != null) copilot.close()
  if (source == null && previousSource != null) {
    activeSubmission.value = null
    isSubmitting.value = false
  }
})

watch(model.notificationCenterOpen, (open) => {
  if (!open) {
    selectedNotificationID.value = null
    selectedPreviewAttachment.value = null
  }
  if (open) visibleNotificationCount.value = notificationPageSize
})

async function handleSubmit(input: SubmitFeedbackInput) {
  if (isSubmitting.value) return

  const submission = Symbol('feedback-submission')
  activeSubmission.value = submission
  isSubmitting.value = true
  try {
    await nextTick()
    await waitForNextPaint()

    const includeContext = input.includeContext !== false
    let screenshotUnavailable = false
    const [context, screenshot] = await Promise.all([
      includeContext
        ? captureFeedbackContext(editorCtxRef.value ?? null, codeEditorRef.value, route.fullPath, i18n.lang.value)
        : Promise.resolve(undefined),
      includeContext
        ? captureFeedbackScreenshot().catch(() => {
            screenshotUnavailable = true
            return null
          })
        : Promise.resolve(null)
    ])
    if (activeSubmission.value !== submission || model.activeFormSource.value !== input.source) return

    model.submitFeedback({
      ...input,
      attachments: screenshot == null ? input.attachments : [...input.attachments, screenshot],
      context
    })
    if (screenshotUnavailable) {
      message.warning(
        t({
          en: 'The page screenshot could not be prepared. Feedback was still sent.',
          zh: '页面截图暂时无法生成，反馈仍已提交。'
        })
      )
    }
    message.success(
      t({
        en: 'Feedback sent.',
        zh: '反馈已提交。'
      })
    )
  } catch {
    message.error(
      t({
        en: 'Feedback could not be sent. Try again.',
        zh: '反馈提交失败，请重试。'
      })
    )
  } finally {
    if (activeSubmission.value === submission) {
      activeSubmission.value = null
      isSubmitting.value = false
    }
  }
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve()
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function captureFeedbackScreenshot(): Promise<FeedbackAttachment> {
  const { blob } = await captureViewport()
  return {
    id: `screenshot-${Date.now()}`,
    name: 'feedback-screenshot.png',
    size: blob.size,
    url: URL.createObjectURL(blob)
  }
}

function openNotification(notification: InProductNotification) {
  selectedPreviewAttachment.value = null
  selectedNotificationID.value = notification.id
  model.markNotificationRead(notification.id)
}

function backToNotificationList() {
  selectedPreviewAttachment.value = null
  selectedNotificationID.value = null
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(i18n.lang.value === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value))
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? Math.max(1, Math.round(size / 1024)) + ' KB' : (size / 1024 / 1024).toFixed(1) + ' MB'
}

function formatImageCount(count: number) {
  return t({
    en: `${count} image${count === 1 ? '' : 's'}`,
    zh: `${count} 张图片`
  })
}

const imageFileExtensionPattern = /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i

function isRenderableImageAttachment(attachment: FeedbackAttachment): attachment is RenderableFeedbackAttachment {
  if (attachment.url == null || attachment.url.trim() === '') return false
  if (attachment.url.startsWith('blob:') || attachment.url.startsWith('data:image/')) return true
  return imageFileExtensionPattern.test(attachment.name) || imageFileExtensionPattern.test(attachment.url)
}

function getNotificationImageAttachments(notification: InProductNotification) {
  return notificationImageAttachmentsMap.value.get(notification.feedbackID) ?? []
}

function getNotificationImageAttachmentCount(notification: InProductNotification) {
  return getNotificationImageAttachments(notification).length
}

function getAttachmentPreviewAriaLabel(attachment: RenderableFeedbackAttachment) {
  return t({
    en: `Preview image: ${attachment.name}`,
    zh: `预览图片：${attachment.name}`
  })
}

function getAttachmentAlt(attachment: RenderableFeedbackAttachment) {
  return t({
    en: `Submitted feedback image: ${attachment.name}`,
    zh: `反馈提交图片：${attachment.name}`
  })
}

function openAttachmentPreview(attachment: RenderableFeedbackAttachment) {
  selectedPreviewAttachment.value = attachment
}

function closeAttachmentPreview() {
  selectedPreviewAttachment.value = null
}

function handlePreviewVisibleChange(visible: boolean) {
  if (!visible) closeAttachmentPreview()
}

function loadMoreNotifications() {
  visibleNotificationCount.value += notificationPageSize
}
</script>

<template>
  <UIFormModal
    :key="model.activeFormSource.value ?? 'closed'"
    :radar="{ name: 'Feedback form', desc: 'Send feedback to the XBuilder team' }"
    :mask-closable="!isSubmitting"
    :title="$t({ en: 'Send feedback', zh: '提交反馈' })"
    :visible="model.activeFormSource.value != null"
    @update:visible="model.closeFeedbackForm"
  >
    <FeedbackForm
      v-if="model.activeFormSource.value != null"
      :source="model.activeFormSource.value"
      :draft="model.data.drafts[model.activeFormSource.value]"
      :submitting="isSubmitting"
      @cancel="model.closeFeedbackForm"
      @submit="handleSubmit"
    />
  </UIFormModal>

  <UIModal
    :visible="model.notificationCenterOpen.value"
    size="small"
    class="w-[520px]"
    :aria-labelledby="notificationTitleID"
    :radar="{ name: 'Notifications', desc: 'Notifications from the XBuilder support team' }"
    @update:visible="model.notificationCenterOpen.value = $event"
  >
    <div v-if="selectedNotification == null">
      <div class="flex items-center justify-between border-b border-grey-400 px-5 py-4">
        <h2 :id="notificationTitleID" class="font-semibold text-title">
          {{ $t({ en: 'Notifications', zh: '通知' }) }}
        </h2>
        <UIButton
          v-radar="{ name: 'Close notifications', desc: 'Close notifications' }"
          :aria-label="$t({ en: 'Close notifications', zh: '关闭通知' })"
          type="white"
          shape="square"
          size="small"
          icon="close"
          @click="model.notificationCenterOpen.value = false"
        />
      </div>

      <div v-if="model.data.notifications.length === 0" class="px-5 py-12 text-center text-sm text-grey-800">
        {{ $t({ en: 'No notifications', zh: '暂无通知' }) }}
      </div>
      <div v-else class="max-h-[480px] overflow-y-auto">
        <button
          v-for="notification in visibleNotifications"
          :key="notification.id"
          v-radar="{
            name: 'Support notification',
            desc: notification.readAt == null ? 'Unread reply from XBuilder Support' : 'Reply from XBuilder Support'
          }"
          class="block w-full cursor-pointer border-b border-grey-200 px-5 py-4 text-left transition-colors last:border-b-0 focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-primary-main"
          :class="
            notification.readAt == null
              ? 'bg-primary-100/40 hover:bg-primary-100/70 active:bg-primary-200'
              : 'bg-white hover:bg-grey-100 active:bg-grey-200'
          "
          @click="openNotification(notification)"
        >
          <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
            <span
              class="mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-transparent"
              :class="notification.readAt == null ? 'bg-primary-main ring-primary-100/70' : 'bg-grey-500'"
            ></span>
            <div class="min-w-0">
              <div class="flex items-start justify-between gap-3">
                <span
                  class="min-w-0 flex-1 truncate text-sm leading-5 text-title"
                  :class="notification.readAt == null ? 'font-semibold' : 'font-medium'"
                >
                  {{ notification.title }}
                </span>
                <time class="shrink-0 text-xs text-grey-800">{{ formatTime(notification.createdAt) }}</time>
              </div>
              <p class="mt-1 line-clamp-2 text-sm leading-5 text-grey-900">{{ notification.body }}</p>
              <div v-if="getNotificationImageAttachmentCount(notification) > 0" class="mt-2 inline-flex items-center gap-1 text-xs text-grey-800">
                <UIIcon type="camera" class="size-3 text-grey-600" />
                <span>{{ formatImageCount(getNotificationImageAttachmentCount(notification)) }}</span>
              </div>
            </div>
            <UIIcon type="arrowRightSmall" class="mt-1 size-4 shrink-0 text-grey-600" />
          </div>
        </button>
        <div
          v-if="visibleNotificationCount < model.data.notifications.length"
          class="border-t border-grey-300 p-3 text-center"
        >
          <UIButton type="white" size="small" @click="loadMoreNotifications">
            {{ $t({ en: 'Load more', zh: '加载更多' }) }}
          </UIButton>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="flex items-center justify-between border-b border-grey-400 px-4 py-4">
        <div class="flex min-w-0 items-center gap-2">
          <UIButton
            v-radar="{ name: 'Back to notifications', desc: 'Return to the notification list' }"
            :aria-label="$t({ en: 'Back to notifications', zh: '返回通知' })"
            type="white"
            shape="square"
            size="small"
            @click="backToNotificationList"
          >
            <template #icon>
              <UIIcon type="arrowRightSmall" class="size-3.5 rotate-180" />
            </template>
          </UIButton>
          <h2 :id="notificationTitleID" class="truncate font-semibold text-title" :title="selectedNotification.title">
            {{ selectedNotification.title }}
          </h2>
        </div>
        <UIButton
          v-radar="{ name: 'Close notification detail', desc: 'Close notifications' }"
          :aria-label="$t({ en: 'Close notifications', zh: '关闭通知' })"
          type="white"
          shape="square"
          size="small"
          icon="close"
          @click="model.notificationCenterOpen.value = false"
        />
      </div>

      <article class="max-h-[480px] overflow-y-auto px-5 py-5">
        <section class="rounded-2xl border border-grey-300 bg-grey-100 px-4 py-4 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-grey-900">
              {{ $t({ en: 'Reply', zh: '回复' }) }}
            </p>
            <time class="shrink-0 text-xs text-grey-800">{{ formatTime(selectedNotification.createdAt) }}</time>
          </div>
          <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-grey-1000">{{ selectedNotification.body }}</p>
        </section>

        <section class="mt-4 rounded-2xl border border-grey-300 bg-white px-4 py-4">
          <p class="text-sm font-medium text-grey-900">
            {{ $t({ en: 'Original feedback', zh: '原始反馈' }) }}
          </p>
          <p class="mt-2 text-sm font-medium leading-5 text-title">
            {{
              selectedNotificationFeedback?.title ??
              $t({ en: 'The original feedback is not available.', zh: '原始反馈暂不可用。' })
            }}
          </p>
          <p
            v-if="selectedNotificationFeedback?.description != null"
            class="mt-1 whitespace-pre-wrap text-sm leading-6 text-grey-900"
          >
            {{ selectedNotificationFeedback.description }}
          </p>
        </section>

        <template v-if="selectedNotificationImageAttachments.length > 0">
          <div class="mt-5 flex items-center justify-between gap-3">
            <h3 class="text-sm font-medium text-grey-900">
              {{ $t({ en: 'Images', zh: '图片' }) }}
            </h3>
            <span class="text-xs text-grey-800">{{ formatImageCount(selectedNotificationImageAttachments.length) }}</span>
          </div>
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              v-for="attachment in selectedNotificationImageAttachments"
              :key="attachment.id"
              type="button"
              class="group block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-black/10 bg-grey-100 text-left shadow-sm transition-colors hover:border-primary-main hover:bg-primary-100/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-main"
              :aria-label="getAttachmentPreviewAriaLabel(attachment)"
              @click="openAttachmentPreview(attachment)"
            >
              <div class="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-grey-200 p-3">
                <img class="h-full w-full object-contain" :src="attachment.url" :alt="getAttachmentAlt(attachment)" />
              </div>
              <div class="px-3 py-2.5">
                <span class="block truncate text-xs font-medium text-title">{{ attachment.name }}</span>
              </div>
            </button>
          </div>
        </template>
      </article>
    </div>
  </UIModal>

  <UIModal
    :visible="selectedPreviewAttachment != null"
    size="large"
    class="w-[min(1040px,calc(100vw-2rem))]"
    :aria-labelledby="imagePreviewTitleID"
    :radar="{ name: 'Feedback image preview', desc: 'Previewing user-submitted feedback image' }"
    @update:visible="handlePreviewVisibleChange"
  >
    <div v-if="selectedPreviewAttachment != null" class="flex max-h-[calc(100vh-2rem)] min-h-[360px] flex-col">
      <div class="flex items-start justify-between gap-3 border-b border-grey-400 px-5 py-4">
        <div class="min-w-0">
          <h2 :id="imagePreviewTitleID" class="truncate text-base font-semibold text-title">
            {{ selectedPreviewAttachment.name }}
          </h2>
          <p class="mt-1 text-xs text-grey-800">{{ formatFileSize(selectedPreviewAttachment.size) }}</p>
        </div>
        <UIModalClose
          :aria-label="$t({ en: 'Close image preview', zh: '关闭图片预览' })"
          @click="closeAttachmentPreview"
        />
      </div>
      <div class="flex min-h-0 flex-1 items-center justify-center bg-grey-100 p-4 sm:p-6">
        <img
          class="max-h-full max-w-full object-contain"
          :src="selectedPreviewAttachment.url"
          :alt="getAttachmentAlt(selectedPreviewAttachment)"
        />
      </div>
    </div>
  </UIModal>
</template>
