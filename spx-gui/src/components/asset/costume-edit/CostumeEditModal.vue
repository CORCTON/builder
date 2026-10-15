<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { useI18n } from '@/utils/i18n'
import { useRenderableImageUrl } from '@/utils/img-rendering'
import type { File } from '@/models/common/file'
import {
  UIButton,
  UIButtonGroup,
  UIButtonGroupItem,
  UIForm,
  UIFormItem,
  UIFormModal,
  UIImg,
  UILoading,
  UITextInput,
  useConfirmDialogWithResult,
  useForm
} from '@/components/ui'
import CheckerboardBackground from '@/components/editor/sprite/CheckerboardBackground.vue'
import CostumeEditVariant from './CostumeEditVariant.vue'
import { createPrototypeCandidate, resolvePrototypeEffect } from './prototype'

const props = defineProps<{ visible: boolean; image: File; name: string }>()
const emit = defineEmits<{ cancelled: []; resolved: [image: File] }>()
const { t } = useI18n()
const confirm = useConfirmDialogWithResult()
const form = useForm({ instruction: [''] })
const instruction = toRef(form.value, 'instruction')
const draft = shallowRef(props.image)
const candidate = shallowRef<File | null>(null)
const variants = shallowRef<File[]>([])
const before = ref(false)
const busy = ref(false)
const error = ref('')
const variation = ref(0)
const input = ref<InstanceType<typeof UITextInput> | null>(null)
let controller: AbortController | null = null
let closing = false

const changed = computed(() => draft.value !== props.image || candidate.value != null)
const displayed = computed(() => (before.value ? draft.value : candidate.value ?? draft.value))
const [src, loading] = useRenderableImageUrl(displayed)
const examples = [
  { en: 'Change to a blue palette', zh: '换成蓝色系' },
  { en: 'Change to a warm palette', zh: '换成暖色系' },
  { en: 'Make the colors softer', zh: '颜色柔和一点' }
]

function stop() {
  controller?.abort()
  controller = null
  busy.value = false
}

async function generate(retry = false) {
  if (busy.value || instruction.value.trim() === '') return
  const effect = resolvePrototypeEffect(instruction.value.trim())
  if (effect == null) {
    error.value = t({
      en: 'This prototype supports blue, warm, or softer colors. Choose an example below; AI editing is not connected yet.',
      zh: '原型仅支持蓝色系、暖色系和柔和配色。请试试下方示例；尚未接入 AI 编辑。'
    })
    return
  }
  stop()
  const request = new AbortController()
  controller = request
  busy.value = true
  error.value = ''
  before.value = false
  if (!retry) {
    candidate.value = null
    variants.value = []
  }
  variation.value = retry ? variation.value + 1 : 0
  try {
    // Keep the local preview asynchronous so cancellation and pending states can be evaluated.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 900)
      request.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          reject(request.signal.reason)
        },
        { once: true }
      )
    })
    const result = await createPrototypeCandidate(draft.value, effect, variation.value, request.signal)
    if (controller === request && props.visible) {
      candidate.value = result
      variants.value = [...variants.value, result].slice(-4)
    }
  } catch {
    if (!request.signal.aborted) {
      error.value = t({
        en: 'The preview could not be created. Your costume is unchanged. Try again.',
        zh: '预览未能生成，原造型没有改变，请重试。'
      })
    }
  } finally {
    request.abort()
    if (controller === request) {
      busy.value = false
      controller = null
    }
  }
}

function discardCandidate() {
  candidate.value = null
  variants.value = []
  before.value = false
  error.value = ''
  input.value?.focus()
}

function continueEditing() {
  if (candidate.value == null) return
  draft.value = candidate.value
  discardCandidate()
  instruction.value = ''
}

function finish() {
  const result = candidate.value ?? draft.value
  if (result === props.image || busy.value) return
  stop()
  emit('resolved', result)
}

async function close() {
  if (closing) return
  closing = true
  try {
    if (changed.value) {
      const discard = await confirm({
        title: t({ en: 'Discard these edits?', zh: '放弃这些修改？' }),
        content: t({
          en: 'Your original costume will be kept. Unsaved previews will be discarded.',
          zh: '原造型会保留，尚未采用的修改将被丢弃。'
        }),
        confirmText: t({ en: 'Discard edits', zh: '放弃修改' }),
        cancelText: t({ en: 'Keep editing', zh: '继续编辑' })
      })
      if (!discard) return
    }
    stop()
    emit('cancelled')
  } finally {
    closing = false
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.isComposing) {
    event.preventDefault()
    void generate()
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) stop()
  }
)
onBeforeUnmount(stop)
</script>

<template>
  <UIFormModal
    style="width: 840px"
    body-class="p-0!"
    :title="$t({ en: 'Modify costume', zh: '修改造型' })"
    :visible="visible"
    :auto-focus="false"
    :mask-closable="false"
    :radar="{ name: 'Costume edit prototype', desc: 'Preview and confirm an edit to the current costume' }"
    @update:visible="close"
  >
    <div class="flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div class="flex min-w-0 items-center gap-2 text-sm">
          <span class="max-w-48 truncate font-medium text-title" :title="name">{{ name }}</span>
          <span v-if="draft !== image" class="text-grey-700">{{ $t({ en: 'Unsaved edits', zh: '修改未保存' }) }}</span>
        </div>
        <UIButtonGroup
          v-if="candidate != null && !busy"
          :value="before ? 'before' : 'after'"
          type="text"
          variant="secondary"
          :aria-label="$t({ en: 'Compare edit', zh: '对比修改' })"
          @update:value="before = $event === 'before'"
        >
          <UIButtonGroupItem value="before">{{ $t({ en: 'Before', zh: '修改前' }) }}</UIButtonGroupItem>
          <UIButtonGroupItem value="after">{{ $t({ en: 'After', zh: '修改后' }) }}</UIButtonGroupItem>
        </UIButtonGroup>
        <span v-else class="text-xs text-grey-700">{{ $t({ en: 'Costume', zh: '造型' }) }}</span>
      </div>

      <div
        class="costume-edit-preview relative mx-6 overflow-hidden rounded-md border border-grey-400"
        :aria-busy="busy"
      >
        <CheckerboardBackground class="absolute inset-0" />
        <UIImg class="absolute inset-8" :src="src" :loading="loading" role="img" :aria-label="name" />
        <div
          v-if="busy"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80"
          role="status"
          aria-live="polite"
        >
          <UILoading class="h-10!" />
          <span class="text-sm text-title">{{ $t({ en: 'Preparing a preview...', zh: '正在准备预览...' }) }}</span>
          <UIButton type="white" size="small" @click="stop">{{ $t({ en: 'Stop', zh: '停止' }) }}</UIButton>
        </div>
      </div>

      <div
        v-if="variants.length > 1"
        class="mt-3 flex items-center justify-center gap-2"
        :aria-label="$t({ en: 'Candidate previews', zh: '候选预览' })"
      >
        <CostumeEditVariant
          v-for="(variant, index) in variants"
          :key="index"
          :image="variant"
          :index="index"
          :selected="candidate === variant"
          :disabled="busy"
          @click="
            candidate = variant
            before = false
          "
        />
      </div>

      <div class="px-6 pt-4 pb-5">
        <p class="mb-4 text-xs leading-relaxed text-grey-700">
          {{
            $t({
              en: 'Interaction prototype · Local whole-image color effects, not AI editing. No credits used.',
              zh: '交互原型 · 仅演示本地整图配色，非 AI 局部编辑，不消耗额度。'
            })
          }}
        </p>

        <UIForm v-if="candidate == null" :form="form" class="flex flex-col gap-3" @submit="generate()">
          <UIFormItem :label="$t({ en: 'What would you like to change?', zh: '想怎么修改？' })">
            <UITextInput
              ref="input"
              v-model:value="instruction"
              type="textarea"
              :rows="2"
              :maxlength="500"
              :disabled="busy"
              :autofocus="true"
              :placeholder="
                $t({
                  en: 'Describe your change. Keep what you already like.',
                  zh: '描述想改的地方，保留已经满意的部分。'
                })
              "
              @keydown="onInputKeydown"
            />
          </UIFormItem>
          <div class="flex flex-wrap gap-2">
            <UIButton
              v-for="example in examples"
              :key="example.en"
              v-radar="{ name: example.en, desc: 'Fill in an example modification instruction' }"
              type="white"
              size="small"
              :disabled="busy"
              @click="
                instruction = $t(example)
                error = ''
                input?.focus()
              "
              >{{ $t(example) }}</UIButton
            >
          </div>
        </UIForm>
        <div v-else class="flex min-h-20 flex-col justify-center gap-2" role="status" aria-live="polite">
          <div class="flex items-center justify-between gap-3">
            <p class="font-medium text-title">{{ instruction }}</p>
            <UIButton type="white" size="small" :disabled="busy" @click="discardCandidate">{{
              $t({ en: 'Edit instruction', zh: '更改要求' })
            }}</UIButton>
          </div>
          <p class="text-sm text-grey-700">
            {{
              $t({
                en: 'Compare the result before you apply it. Your costume has not changed yet.',
                zh: '切换修改前后，确认是否满意。原造型还没有改变。'
              })
            }}
          </p>
        </div>

        <p v-if="error !== ''" class="mt-3 text-sm text-red-500" role="alert">{{ error }}</p>
      </div>

      <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-grey-400 px-6 py-4">
        <UIButton
          v-radar="{ name: 'Cancel costume edit', desc: 'Close without changing the costume' }"
          type="neutral"
          @click="close"
          >{{ $t({ en: 'Cancel', zh: '取消' }) }}</UIButton
        >
        <div v-if="candidate != null" class="flex flex-wrap justify-end gap-2">
          <UIButton type="white" :disabled="busy" @click="generate(true)">{{
            $t({ en: 'Try again', zh: '再试一次' })
          }}</UIButton>
          <UIButton type="secondary" :disabled="busy" @click="continueEditing">{{
            $t({ en: 'Continue editing', zh: '继续修改' })
          }}</UIButton>
          <UIButton
            v-radar="{ name: 'Apply costume edit', desc: 'Apply the preview and close' }"
            type="primary"
            :disabled="busy"
            @click="finish"
            >{{ $t({ en: 'Apply', zh: '采用修改' }) }}</UIButton
          >
        </div>
        <div v-else class="flex flex-wrap justify-end gap-2">
          <UIButton v-if="draft !== image" type="white" :disabled="busy" @click="finish">{{
            $t({ en: 'Done', zh: '完成' })
          }}</UIButton>
          <UIButton
            v-radar="{ name: 'Preview costume edit', desc: 'Create a candidate without modifying the project' }"
            type="primary"
            :disabled="instruction.trim() === '' || busy"
            :loading="busy"
            @click="generate()"
            >{{ $t({ en: 'Preview edit', zh: '生成预览' }) }}</UIButton
          >
        </div>
      </footer>
    </div>
  </UIFormModal>
</template>

<style scoped>
.costume-edit-preview {
  height: clamp(200px, 35vh, 360px);
}
</style>
