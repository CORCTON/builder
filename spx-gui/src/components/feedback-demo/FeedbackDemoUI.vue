<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useI18n } from '@/utils/i18n'
import { UIButton, UIFormModal, UIIcon, UIModal, useMessage } from '@/components/ui'
import { useCopilot } from '@/components/copilot/context'
import FeedbackForm from './FeedbackForm.vue'
import { useFeedbackDemoModel, type SubmitFeedbackInput } from './model'
import type { InProductNotification } from './mock-data'

const model = useFeedbackDemoModel()
const copilot = useCopilot()
const i18n = useI18n()
const { t } = i18n
const message = useMessage()
const selectedNotificationID = ref<string | null>(null)
const notificationTransition = ref<'notification-forward' | 'notification-back'>('notification-forward')
const selectedNotification = computed(
  () => model.data.notifications.find((notification) => notification.id === selectedNotificationID.value) ?? null
)

watch(model.activeFormSource, (source) => {
  if (source != null) copilot.close()
})

watch(model.notificationCenterOpen, (open) => {
  if (!open) selectedNotificationID.value = null
})

function handleSubmit(input: SubmitFeedbackInput) {
  model.submitFeedback(input)
  message.success(
    t({
      en: 'Feedback sent.',
      zh: '反馈已提交。'
    })
  )
}

function openNotification(notification: InProductNotification) {
  notificationTransition.value = 'notification-forward'
  selectedNotificationID.value = notification.id
  model.markNotificationRead(notification.id)
}

function backToNotificationList() {
  notificationTransition.value = 'notification-back'
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
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatAttachmentCount(count: number) {
  return t({
    en: `${count} ${count === 1 ? 'attachment' : 'attachments'}`,
    zh: `${count} 个附件`
  })
}
</script>

<template>
  <UIFormModal
    v-if="model.activeFormSource.value != null"
    :key="model.activeFormSource.value"
    :radar="{ name: 'Feedback form', desc: 'Send feedback to the XBuilder team' }"
    :title="$t({ en: 'Send feedback', zh: '提交反馈' })"
    :visible="true"
    @update:visible="model.closeFeedbackForm"
  >
    <FeedbackForm
      :source="model.activeFormSource.value"
      :draft="model.data.drafts[model.activeFormSource.value]"
      @cancel="model.closeFeedbackForm"
      @submit="handleSubmit"
    />
  </UIFormModal>

  <UIModal
    :visible="model.notificationCenterOpen.value"
    size="small"
    class="w-[520px]"
    :radar="{ name: 'Notifications', desc: 'Notifications from the XBuilder support team' }"
    @update:visible="model.notificationCenterOpen.value = $event"
  >
    <div class="overflow-hidden">
      <Transition :name="notificationTransition" mode="out-in">
        <div v-if="selectedNotification == null" key="notification-list">
          <div class="flex items-center justify-between border-b border-grey-400 px-5 py-4">
            <h2 class="font-semibold text-title">{{ $t({ en: 'Notifications', zh: '通知' }) }}</h2>
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

          <div v-if="model.data.notifications.length === 0" class="px-5 py-12 text-center text-sm text-grey-700">
            {{ $t({ en: 'No notifications', zh: '暂无通知' }) }}
          </div>
          <div v-else class="max-h-[480px] overflow-y-auto">
            <button
              v-for="notification in model.data.notifications"
              :key="notification.id"
              v-radar="{
                name: 'Support notification',
                desc: notification.readAt == null ? 'Unread reply from XBuilder Support' : 'Reply from XBuilder Support'
              }"
              class="block w-full appearance-none cursor-pointer border-x-0 border-t-0 border-b border-grey-300 px-5 py-4 text-left shadow-none last:border-b-0 hover:bg-grey-200"
              :class="notification.readAt == null ? 'bg-primary-100/60' : 'bg-transparent'"
              @click="openNotification(notification)"
            >
              <div class="flex items-start gap-3">
                <span
                  class="mt-1.5 size-2 shrink-0 rounded-full"
                  :class="notification.readAt == null ? 'bg-primary-main' : 'bg-transparent'"
                ></span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-3">
                    <span
                      class="truncate text-sm text-title"
                      :class="notification.readAt == null ? 'font-semibold' : 'font-normal'"
                    >
                      {{ notification.title }}
                    </span>
                    <time class="shrink-0 text-xs text-grey-700">{{ formatTime(notification.createdAt) }}</time>
                  </div>
                  <p class="mt-1 truncate text-sm text-grey-900">{{ notification.body }}</p>
                  <div
                    v-if="notification.attachments.length > 0"
                    class="mt-2 flex items-center gap-1 text-xs text-grey-700"
                  >
                    <UIIcon type="file" class="size-3" />
                    {{ formatAttachmentCount(notification.attachments.length) }}
                  </div>
                </div>
                <UIIcon type="arrowRightSmall" class="mt-1 size-4 shrink-0 text-grey-600" />
              </div>
            </button>
          </div>
        </div>

        <div v-else key="notification-detail">
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
              <h2 class="truncate font-semibold text-title" :title="selectedNotification.title">
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
            <p class="whitespace-pre-wrap text-sm leading-6 text-grey-1000">{{ selectedNotification.body }}</p>

            <section v-if="selectedNotification.attachments.length > 0" class="mt-6">
              <h4 class="text-sm font-semibold text-title">{{ $t({ en: 'Attachments', zh: '附件' }) }}</h4>
              <div class="mt-2 space-y-2">
                <div
                  v-for="attachment in selectedNotification.attachments"
                  :key="attachment.id"
                  class="flex items-center gap-3 rounded-lg border border-grey-400 bg-grey-100 px-3 py-3"
                >
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-grey-300 text-grey-900">
                    <UIIcon type="file" class="size-4" />
                  </span>
                  <div class="min-w-0">
                    <a
                      v-if="attachment.url != null"
                      class="block truncate text-sm font-medium text-title hover:text-primary-main"
                      :href="attachment.url"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ attachment.name }}
                    </a>
                    <p v-else class="truncate text-sm font-medium text-title">{{ attachment.name }}</p>
                    <p class="mt-0.5 text-xs text-grey-700">{{ formatFileSize(attachment.size) }}</p>
                  </div>
                </div>
              </div>
            </section>
          </article>
        </div>
      </Transition>
    </div>
  </UIModal>
</template>

<style scoped>
.notification-forward-enter-active,
.notification-forward-leave-active,
.notification-back-enter-active,
.notification-back-leave-active {
  transition:
    opacity 160ms ease,
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
}

.notification-forward-enter-from,
.notification-back-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.notification-forward-leave-to,
.notification-back-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

@media (prefers-reduced-motion: reduce) {
  .notification-forward-enter-active,
  .notification-forward-leave-active,
  .notification-back-enter-active,
  .notification-back-leave-active {
    transition: opacity 120ms ease;
  }

  .notification-forward-enter-from,
  .notification-forward-leave-to,
  .notification-back-enter-from,
  .notification-back-leave-to {
    transform: none;
  }
}
</style>
