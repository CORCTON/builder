<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { LocaleMessage } from '@/utils/i18n'
import { usePageTitle } from '@/utils/utils'
import { UIButton, UIIcon, UITextInput } from '@/components/ui'
import { useFeedbackDemoModel } from '@/components/feedback-demo/model'
import type {
  FeedbackAttachment,
  FeedbackSource,
  FeedbackStatus,
  FeedbackSubmission
} from '@/components/feedback-demo/mock-data'

usePageTitle({ en: 'Feedback', zh: '用户反馈' })

const router = useRouter()
const feedbackDemo = useFeedbackDemoModel()
const selectedFeedbackID = ref<string | null>(null)
const reply = ref('')
const replyAttachments = ref<FeedbackAttachment[]>([])
const replySent = ref(false)

const sourceLabels: Record<FeedbackSource, LocaleMessage> = {
  globalForm: { en: 'Profile', zh: '个人中心' }
}

const statusLabels = {
  new: { en: 'New', zh: '新反馈' },
  handled: { en: 'Handled', zh: '已处理' },
  replied: { en: 'Replied', zh: '已回复' }
} satisfies Record<FeedbackSubmission['status'], LocaleMessage>

const statusClasses: Record<FeedbackStatus, string> = {
  new: 'bg-primary-100 text-primary-main',
  handled: 'bg-grey-300 text-grey-800',
  replied: 'bg-green-100 text-green-700'
}

const selectedFeedback = computed(
  () => feedbackDemo.data.feedbacks.find((feedback) => feedback.id === selectedFeedbackID.value) ?? null
)

const newCount = computed(() => feedbackDemo.data.feedbacks.filter((feedback) => feedback.status === 'new').length)

watch(selectedFeedbackID, () => {
  reply.value = ''
  replyAttachments.value = []
  replySent.value = false
})

function handleReply() {
  if (selectedFeedback.value == null) return
  const updated = feedbackDemo.replyToFeedback(selectedFeedback.value.id, reply.value, replyAttachments.value)
  if (updated == null) return
  reply.value = ''
  replyAttachments.value = []
  replySent.value = true
}

function handleMarkHandled() {
  if (selectedFeedback.value == null) return
  feedbackDemo.markFeedbackHandled(selectedFeedback.value.id)
  reply.value = ''
  replyAttachments.value = []
}

function handleReplyFiles(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files == null) return
  const sequence = Date.now()
  replyAttachments.value = [
    ...replyAttachments.value,
    ...Array.from(input.files).map((file, index) => ({
      id: `reply-attachment-${sequence}-${index}`,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file)
    }))
  ]
  input.value = ''
}

function removeReplyAttachment(id: string) {
  const attachment = replyAttachments.value.find((item) => item.id === id)
  if (attachment?.url?.startsWith('blob:')) URL.revokeObjectURL(attachment.url)
  replyAttachments.value = replyAttachments.value.filter((attachment) => attachment.id !== id)
}

function showUserNotification() {
  feedbackDemo.openNotificationCenter()
  router.push('/')
}

function resetMockData() {
  feedbackDemo.reset()
  selectedFeedbackID.value = null
  reply.value = ''
  replyAttachments.value = []
  replySent.value = false
}

function formatTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

function formatListTime(value: string) {
  return dayjs(value).format('MM-DD HH:mm')
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <section class="min-w-0">
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="m-0 text-xl font-semibold text-title">{{ $t({ en: 'User feedback', zh: '用户反馈' }) }}</h2>
        <p class="m-0 mt-1 text-sm text-grey-800">
          {{
            $t({
              en: 'Review feedback and reply when needed.',
              zh: '查看反馈，并在需要时回复用户。'
            })
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="rounded-full bg-primary-100 px-3 py-1 text-xs text-primary-main">
          {{ $t({ en: `${newCount} new`, zh: `${newCount} 条新反馈` }) }}
        </span>
        <UIButton
          v-radar="{ name: 'Reset feedback mock data', desc: 'Restore the editable feedback demo fixtures' }"
          type="white"
          icon="reload"
          @click="resetMockData"
        >
          {{ $t({ en: 'Reset mock data', zh: '重置 Mock 数据' }) }}
        </UIButton>
      </div>
    </div>

    <div
      class="grid min-h-[600px] overflow-hidden rounded-lg border border-grey-400 bg-white desktop:grid-cols-[22rem_minmax(0,1fr)]"
    >
      <div
        class="border-b border-grey-400 desktop:block desktop:border-r desktop:border-b-0"
        :class="selectedFeedback != null ? 'hidden' : 'block'"
      >
        <div class="border-b border-grey-400 bg-grey-100 px-4 py-3 text-sm font-medium text-title">
          {{ $t({ en: 'All feedback', zh: '全部反馈' }) }} · {{ feedbackDemo.data.feedbacks.length }}
        </div>
        <div class="max-h-[650px] overflow-y-auto">
          <button
            v-for="feedback in feedbackDemo.data.feedbacks"
            :key="feedback.id"
            v-radar="{ name: 'Feedback item', desc: `Open feedback: ${feedback.title}` }"
            type="button"
            :aria-current="selectedFeedbackID === feedback.id ? 'true' : undefined"
            class="block w-full appearance-none cursor-pointer border-x-0 border-t-0 border-b border-grey-300 px-4 py-4 text-left shadow-none transition-colors focus-visible:relative focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-primary-main"
            :class="
              selectedFeedbackID === feedback.id
                ? 'bg-primary-100 hover:bg-primary-100'
                : 'bg-transparent hover:bg-grey-100'
            "
            @click="selectedFeedbackID = feedback.id"
          >
            <div class="flex items-start justify-between gap-3">
              <span class="line-clamp-2 text-sm font-medium leading-5 text-title">{{ feedback.title }}</span>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs" :class="statusClasses[feedback.status]">
                {{ $t(statusLabels[feedback.status]) }}
              </span>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs text-grey-700">
              <span>{{ feedback.userDisplayName }}</span>
              <time>{{ formatListTime(feedback.createdAt) }}</time>
            </div>
          </button>
        </div>
      </div>

      <div v-if="selectedFeedback != null" class="p-5 tablet:p-7">
        <UIButton type="white" size="small" class="mb-4 desktop:hidden" @click="selectedFeedbackID = null">
          <template #icon>
            <UIIcon type="arrowRightSmall" class="size-3.5 rotate-180" />
          </template>
          {{ $t({ en: 'Feedback list', zh: '反馈列表' }) }}
        </UIButton>
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-grey-400 pb-5">
          <div>
            <div class="mb-2 flex flex-wrap gap-2 text-xs">
              <span class="rounded-full px-2.5 py-1" :class="statusClasses[selectedFeedback.status]">
                {{ $t(statusLabels[selectedFeedback.status]) }}
              </span>
            </div>
            <h3 class="text-xl font-semibold text-title">{{ selectedFeedback.title }}</h3>
            <p class="mt-1 text-xs text-grey-700">
              {{ selectedFeedback.userDisplayName }} · {{ formatTime(selectedFeedback.createdAt) }}
            </p>
          </div>
        </div>

        <div class="py-6">
          <h4 class="text-sm font-semibold text-title">{{ $t({ en: 'Description', zh: '描述' }) }}</h4>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-6 text-grey-1000">{{ selectedFeedback.description }}</p>

          <template v-if="selectedFeedback.attachments.length > 0">
            <h4 class="mt-6 text-sm font-semibold text-title">{{ $t({ en: 'Attachments', zh: '附件' }) }}</h4>
            <div class="mt-2 flex flex-wrap gap-2">
              <template v-for="attachment in selectedFeedback.attachments" :key="attachment.id">
                <a
                  v-if="attachment.url != null"
                  class="inline-flex items-center gap-2 rounded-md bg-grey-300 px-3 py-2 text-xs text-grey-900 no-underline transition-colors hover:bg-grey-400 hover:text-primary-main focus-visible:outline-2 focus-visible:outline-primary-main"
                  :href="attachment.url"
                  target="_blank"
                  rel="noreferrer"
                >
                  <UIIcon type="file" class="size-3.5" />
                  {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
                </a>
                <span
                  v-else
                  class="inline-flex items-center gap-2 rounded-md bg-grey-300 px-3 py-2 text-xs text-grey-900"
                >
                  <UIIcon type="file" class="size-3.5" />
                  {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
                </span>
              </template>
            </div>
          </template>

          <dl class="mt-6 grid gap-3 border-t border-grey-300 pt-5 text-xs tablet:grid-cols-2">
            <div>
              <dt class="text-grey-700">{{ $t({ en: 'Submitted from', zh: '提交入口' }) }}</dt>
              <dd class="mt-1 text-grey-1000">{{ $t(sourceLabels[selectedFeedback.source]) }}</dd>
            </div>
            <div>
              <dt class="text-grey-700">{{ $t({ en: 'Feedback ID', zh: '反馈 ID' }) }}</dt>
              <dd class="mt-1 select-all font-mono text-grey-1000">{{ selectedFeedback.id }}</dd>
            </div>
          </dl>
        </div>

        <div v-if="selectedFeedback.status === 'new'" class="rounded-lg border border-grey-400 bg-grey-100 p-4">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-title">{{ $t({ en: 'Reply to user', zh: '回复用户' }) }}</span>
            <UITextInput
              v-model:value="reply"
              v-radar="{ name: 'Support reply', desc: 'Write the one-time message delivered to the user' }"
              type="textarea"
              :rows="4"
              :maxlength="1000"
              :placeholder="$t({ en: 'Write a clear reply for the user', zh: '填写一条清晰的用户回复' })"
            />
          </label>
          <div class="mt-3">
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-grey-500 bg-white px-3 py-2 text-xs text-grey-900 transition-colors hover:border-primary-main hover:bg-primary-100"
            >
              <UIIcon type="localFile" class="size-3.5" />
              {{ $t({ en: 'Attach files', zh: '添加附件' }) }}
              <input
                v-radar="{ name: 'Reply attachments', desc: 'Choose optional files to send with the support reply' }"
                class="sr-only"
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.log,.zip"
                @change="handleReplyFiles"
              />
            </label>
            <div v-if="replyAttachments.length > 0" class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="attachment in replyAttachments"
                :key="attachment.id"
                class="inline-flex items-center gap-2 rounded-md bg-grey-300 px-2.5 py-1.5 text-xs text-grey-900"
              >
                <UIIcon type="file" class="size-3.5" />
                {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
                <button
                  v-radar="{ name: 'Remove reply attachment', desc: `Remove ${attachment.name} from the reply` }"
                  type="button"
                  class="inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-grey-800 transition-colors hover:bg-grey-400 hover:text-red-main focus-visible:outline-2 focus-visible:outline-primary-main"
                  @click="removeReplyAttachment(attachment.id)"
                >
                  <UIIcon type="close" class="size-3" />
                </button>
              </span>
            </div>
          </div>
          <div class="mt-3 flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
            <UIButton type="white" @click="handleMarkHandled">
              {{ $t({ en: 'Handle without reply', zh: '无需回复，标记已处理' }) }}
            </UIButton>
            <div class="flex flex-col items-start gap-2 tablet:items-end">
              <p class="text-xs text-grey-700">
                {{ $t({ en: 'The user will receive this as a new message.', zh: '用户会收到一条新站内信。' }) }}
              </p>
              <UIButton
                v-radar="{ name: 'Send support reply', desc: 'Send this reply as an in-product message' }"
                :disabled="reply.trim() === ''"
                @click="handleReply"
              >
                {{ $t({ en: 'Send reply', zh: '发送回复' }) }}
              </UIButton>
            </div>
          </div>
        </div>

        <div
          v-else-if="selectedFeedback.status === 'replied'"
          class="rounded-lg border border-green-300 bg-green-100 p-4"
        >
          <div class="flex items-start gap-3">
            <UIIcon type="success" class="mt-0.5 shrink-0 text-green-600" />
            <div>
              <h4 class="text-sm font-semibold text-title">{{ $t({ en: 'Reply sent', zh: '回复已发送' }) }}</h4>
              <p class="mt-1 text-sm leading-6 text-grey-1000">{{ selectedFeedback.reply }}</p>
              <div v-if="selectedFeedback.replyAttachments.length > 0" class="mt-3 flex flex-wrap gap-2">
                <template v-for="attachment in selectedFeedback.replyAttachments" :key="attachment.id">
                  <a
                    v-if="attachment.url != null"
                    class="inline-flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-grey-900 no-underline transition-colors hover:bg-white hover:text-primary-main focus-visible:outline-2 focus-visible:outline-primary-main"
                    :href="attachment.url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <UIIcon type="file" class="size-3.5" />
                    {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
                  </a>
                  <span
                    v-else
                    class="inline-flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-grey-900"
                  >
                    <UIIcon type="file" class="size-3.5" />
                    {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
                  </span>
                </template>
              </div>
              <time v-if="selectedFeedback.repliedAt != null" class="mt-2 block text-xs text-grey-700">
                {{ formatTime(selectedFeedback.repliedAt) }}
              </time>
            </div>
          </div>
        </div>

        <div v-else class="rounded-lg border border-grey-400 bg-grey-100 p-4">
          <div class="flex items-start gap-3">
            <UIIcon type="success" class="mt-0.5 shrink-0 text-green-600" />
            <div>
              <h4 class="text-sm font-semibold text-title">
                {{ $t({ en: 'Handled without reply', zh: '无需回复，已处理' }) }}
              </h4>
              <p class="mt-1 text-sm text-grey-900">
                {{ $t({ en: 'No message was sent to the user.', zh: '未向用户发送站内信。' }) }}
              </p>
              <time v-if="selectedFeedback.handledAt != null" class="mt-2 block text-xs text-grey-700">
                {{ formatTime(selectedFeedback.handledAt) }}
              </time>
            </div>
          </div>
        </div>

        <div
          v-if="replySent"
          class="mt-4 flex items-center justify-between gap-3 rounded-lg bg-primary-100 px-4 py-3 text-sm text-primary-main"
        >
          <span>{{
            $t({ en: 'An unread message is ready for the user.', zh: '用户现在有一条新的未读站内信。' })
          }}</span>
          <UIButton type="white" size="small" @click="showUserNotification">
            {{ $t({ en: 'View as user', zh: '切换到用户查看' }) }}
          </UIButton>
        </div>
      </div>

      <div v-else class="hidden items-center justify-center p-8 text-sm text-grey-700 desktop:flex">
        {{ $t({ en: 'Select a feedback item', zh: '请选择一条反馈' }) }}
      </div>
    </div>
  </section>
</template>
