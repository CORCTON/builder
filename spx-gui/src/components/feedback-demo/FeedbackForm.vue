<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '@/utils/i18n'
import { UIButton, UIForm, UIFormItem, UIIcon, UITextInput, useForm } from '@/components/ui'
import type { FeedbackAttachment, FeedbackDraft, FeedbackSource } from './mock-data'
import type { SubmitFeedbackInput } from './model'

const props = defineProps<{
  source: FeedbackSource
  draft: FeedbackDraft
}>()

const emit = defineEmits<{
  cancel: []
  submit: [SubmitFeedbackInput]
}>()

const { t } = useI18n()
const form = useForm({
  title: [props.draft.title, validateTitle],
  description: [props.draft.description, validateDescription]
})
const attachments = ref<FeedbackAttachment[]>(props.draft.attachments.map((attachment) => ({ ...attachment })))
const canSubmit = computed(() => form.value.title.trim() !== '' && form.value.description.trim() !== '')

const sourceTips: Record<FeedbackSource, { en: string; zh: string }> = {
  globalForm: {
    en: 'XBuilder Support will receive your title, description, and attachments.',
    zh: 'XBuilder 支持团队将收到标题、描述和附件。'
  }
}

function handleFiles(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (files == null) return
  for (const attachment of attachments.value) {
    if (attachment.url?.startsWith('blob:')) URL.revokeObjectURL(attachment.url)
  }
  attachments.value = Array.from(files).map((file, index) => ({
    id: `local-attachment-${index}`,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file)
  }))
}

function removeAttachment(id: string) {
  const attachment = attachments.value.find((item) => item.id === id)
  if (attachment?.url?.startsWith('blob:')) URL.revokeObjectURL(attachment.url)
  attachments.value = attachments.value.filter((attachment) => attachment.id !== id)
}

function validateTitle(value: string) {
  if (value.trim() === '') return t({ en: 'Enter a short title', zh: '请填写一个简短的标题' })
  return null
}

function validateDescription(value: string) {
  if (value.trim() === '') return t({ en: 'Describe what happened', zh: '请描述发生了什么' })
  return null
}

function submit() {
  emit('submit', {
    source: props.source,
    title: form.value.title,
    description: form.value.description,
    attachments: attachments.value
  })
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div>
    <p class="mb-5 text-sm text-grey-800">{{ $t(sourceTips[source]) }}</p>

    <UIForm :form="form" @submit="submit">
      <UIFormItem :label="$t({ en: 'Title', zh: '标题' })" path="title">
        <UITextInput
          v-model:value="form.value.title"
          v-radar="{ name: 'Feedback title', desc: 'A short title for this feedback' }"
          :placeholder="$t({ en: 'Briefly describe the problem', zh: '用一句话概括问题' })"
          :maxlength="100"
          clearable
        />
      </UIFormItem>

      <UIFormItem :label="$t({ en: 'Description', zh: '详细描述' })" path="description">
        <UITextInput
          v-model:value="form.value.description"
          v-radar="{ name: 'Feedback description', desc: 'Detailed description of the feedback' }"
          type="textarea"
          :rows="5"
          :maxlength="2000"
          :placeholder="$t({ en: 'What happened? What did you expect?', zh: '发生了什么？你原本希望发生什么？' })"
        />
      </UIFormItem>

      <UIFormItem :label="$t({ en: 'Attachments (optional)', zh: '附件（可选）' })">
        <label
          class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-grey-500 bg-grey-200 px-4 py-3 text-sm text-grey-900 transition-colors hover:border-primary-main hover:bg-primary-100"
        >
          <UIIcon type="localFile" />
          {{ $t({ en: 'Choose files', zh: '选择文件' }) }}
          <input
            v-radar="{ name: 'Feedback attachments', desc: 'Choose optional files to attach to the feedback' }"
            class="sr-only"
            type="file"
            multiple
            accept="image/*,.txt,.log,.zip"
            @change="handleFiles"
          />
        </label>
        <div v-if="attachments.length > 0" class="mt-2 flex flex-wrap gap-2">
          <span
            v-for="attachment in attachments"
            :key="attachment.id"
            class="inline-flex items-center gap-2 rounded-md bg-grey-300 px-2.5 py-1.5 text-xs text-grey-900"
          >
            <UIIcon type="file" class="size-3.5" />
            {{ attachment.name }} · {{ formatFileSize(attachment.size) }}
            <button
              v-radar="{ name: 'Remove attachment', desc: `Remove ${attachment.name} from the feedback` }"
              type="button"
              class="inline-flex size-5 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-grey-800 transition-colors hover:bg-grey-400 hover:text-red-main focus-visible:outline-2 focus-visible:outline-primary-main"
              @click="removeAttachment(attachment.id)"
            >
              <UIIcon type="close" class="size-3" />
            </button>
          </span>
        </div>
      </UIFormItem>

      <footer class="mt-6 flex justify-end gap-3">
        <UIButton type="neutral" @click="emit('cancel')">{{ $t({ en: 'Cancel', zh: '取消' }) }}</UIButton>
        <UIButton
          v-radar="{ name: 'Submit feedback', desc: 'Submit this feedback to the mock feedback pool' }"
          html-type="submit"
          :disabled="!canSubmit"
        >
          {{ $t({ en: 'Send feedback', zh: '提交反馈' }) }}
        </UIButton>
      </footer>
    </UIForm>
  </div>
</template>
