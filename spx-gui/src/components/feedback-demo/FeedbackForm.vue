<script setup lang="ts">
import { ref, useId } from 'vue'

import { useI18n } from '@/utils/i18n'
import { UIButton, UIForm, UIFormItem, UIIcon, UISwitch, UITextInput, useForm } from '@/components/ui'
import type { FeedbackAttachment, FeedbackDraft, FeedbackSource } from './mock-data'
import type { SubmitFeedbackInput } from './model'

const props = defineProps<{
  source: FeedbackSource
  draft: FeedbackDraft
  submitting?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  submit: [SubmitFeedbackInput]
}>()

const { t } = useI18n()
const contextTitleID = useId()
const contextDescriptionID = useId()
const form = useForm({
  title: [props.draft.title, validateTitle],
  description: [props.draft.description, validateDescription]
})
const attachments = ref<FeedbackAttachment[]>(props.draft.attachments.map((attachment) => ({ ...attachment })))
const includeContext = ref(props.draft.includeContext ?? true)

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
    attachments: attachments.value,
    includeContext: includeContext.value
  })
}

function formatFileSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div :aria-busy="props.submitting || undefined">
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

      <UIFormItem>
        <label
          class="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-grey-200 px-3 py-2 text-sm text-grey-900 transition-colors hover:bg-grey-300 active:bg-grey-400 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-main"
        >
          <UIIcon type="localFile" class="size-4" />
          {{ $t({ en: 'Add attachments', zh: '添加附件' }) }}
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
              :aria-label="$t({ en: `Remove attachment: ${attachment.name}`, zh: `移除附件：${attachment.name}` })"
              type="button"
              class="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-grey-800 transition-colors hover:bg-grey-400 active:bg-grey-500 hover:text-red-main focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-main"
              @click="removeAttachment(attachment.id)"
            >
              <UIIcon type="close" class="size-3" />
            </button>
          </span>
        </div>
      </UIFormItem>

      <section class="mt-6 border-t border-grey-300 pt-4" :aria-labelledby="contextTitleID">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 :id="contextTitleID" class="text-sm font-medium text-title">
              {{ $t({ en: 'Share diagnostic details', zh: '分享诊断信息' }) }}
            </h3>
            <p :id="contextDescriptionID" class="mt-1 text-xs leading-5 text-grey-800">
              {{
                $t({
                  en: 'Includes the current page and language, project structure, selected sprite, nearby code, diagnostics, and the latest 50 runtime outputs.',
                  zh: '包含当前页面与语言、项目结构、所选角色、附近代码、代码诊断和最近 50 条运行输出。'
                })
              }}
            </p>
          </div>
          <UISwitch
            v-model:value="includeContext"
            v-radar="{ name: 'Share diagnostic details', desc: 'Choose whether to share troubleshooting details' }"
            class="mt-0.5 shrink-0"
            :aria-labelledby="contextTitleID"
            :aria-describedby="contextDescriptionID"
          />
        </div>
      </section>

      <footer class="mt-6 flex justify-end gap-3">
        <UIButton type="neutral" :disabled="props.submitting" @click="emit('cancel')">
          {{ $t({ en: 'Cancel', zh: '取消' }) }}
        </UIButton>
        <UIButton
          v-radar="{ name: 'Submit feedback', desc: 'Submit this feedback to the mock feedback pool' }"
          html-type="submit"
          :disabled="props.submitting"
          :loading="props.submitting"
        >
          {{ $t({ en: 'Send feedback', zh: '提交反馈' }) }}
        </UIButton>
      </footer>
    </UIForm>
  </div>
</template>
