<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { useI18n } from '@/utils/i18n'
import { useRenderableImageUrl } from '@/utils/img-rendering'
import type { File } from '@/models/common/file'
import {
  UIButton,
  UIForm,
  UIFormItem,
  UIFormModal,
  UIIcon,
  UIImg,
  UILoading,
  UISlider,
  UITextInput,
  useConfirmDialogWithResult,
  useForm
} from '@/components/ui'
import CheckerboardBackground from '@/components/editor/sprite/CheckerboardBackground.vue'
import CostumeEditVariant from './CostumeEditVariant.vue'
import { createPrototypeCandidate, resizeImage, resolvePrototypeEffect } from './prototype'

// Editing surface for one costume. Modules (AI edit, adjust, future crop/mask)
// all transform the same draft; nothing reaches the project until Done.
const props = defineProps<{ visible: boolean; image: File; name: string }>()
const emit = defineEmits<{ cancelled: []; resolved: [image: File] }>()
const { t } = useI18n()
const confirm = useConfirmDialogWithResult()
const form = useForm({ instruction: [''] })
const instruction = toRef(form.value, 'instruction')
const draft = shallowRef(props.image)
const draftHistory = shallowRef<File[]>([])
const candidate = shallowRef<File | null>(null)
const variants = shallowRef<File[]>([])
const before = ref(false)
const busy = ref(false)
const error = ref('')
const variation = ref(0)
const activeModule = ref<'ai' | 'adjust'>('ai')
const scale = ref(100)
const input = ref<InstanceType<typeof UITextInput> | null>(null)
let controller: AbortController | null = null
let closing = false

const changed = computed(() => draft.value !== props.image || candidate.value != null)
const displayed = computed(() => (before.value ? draft.value : candidate.value ?? draft.value))
const [src, loading] = useRenderableImageUrl(displayed)
const previewZoom = computed(() =>
  activeModule.value === 'adjust' && candidate.value == null && !before.value && !busy.value ? scale.value / 100 : 1
)
const modules = [
  { value: 'ai', icon: 'remix', label: { en: 'AI edit', zh: 'AI 修改' } },
  { value: 'adjust', icon: 'resize', label: { en: 'Adjust', zh: '调整' } }
] as const
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

function pushHistory() {
  draftHistory.value = [...draftHistory.value, draft.value].slice(-10)
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

function keepCandidate() {
  if (candidate.value == null) return
  pushHistory()
  draft.value = candidate.value
  discardCandidate()
  instruction.value = ''
  activeModule.value = 'ai'
}

function selectVariant(image: File) {
  candidate.value = image
  before.value = false
}

function chooseExample(value: string) {
  instruction.value = value
  error.value = ''
  input.value?.focus()
}

function switchModule(value: unknown) {
  if (value === 'ai' || value === 'adjust') {
    activeModule.value = value
    error.value = ''
  }
}

function undoLast() {
  const previous = draftHistory.value[draftHistory.value.length - 1]
  if (previous == null || busy.value) return
  draftHistory.value = draftHistory.value.slice(0, -1)
  draft.value = previous
  discardCandidate()
  scale.value = 100
}

async function applyScale() {
  const factor = scale.value / 100
  if (busy.value || Math.abs(factor - 1) < 0.001) return
  stop()
  busy.value = true
  error.value = ''
  const request = new AbortController()
  try {
    const result = await resizeImage(draft.value, factor, request.signal)
    pushHistory()
    draft.value = result
    scale.value = 100
  } catch {
    error.value = t({
      en: 'The adjustment could not be applied. Your costume is unchanged. Try again.',
      zh: '调整未能应用，原造型没有改变，请重试。'
    })
  } finally {
    busy.value = false
  }
}

function finish() {
  if (busy.value) return
  const result = candidate.value ?? draft.value
  stop()
  if (result === props.image) emit('cancelled')
  else emit('resolved', result)
}

async function close() {
  if (closing) return
  closing = true
  try {
    if (changed.value) {
      const discard = await confirm({
        title: t({ en: 'Discard these edits?', zh: '放弃这些修改？' }),
        content: t({
          en: 'Your original costume will be kept. Unsaved changes will be discarded.',
          zh: '原造型会保留，尚未完成的修改将被丢弃。'
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
    style="width: 800px"
    body-class="p-0!"
    :title="$t({ en: 'Edit costume', zh: '编辑造型' })"
    :visible="visible"
    :auto-focus="false"
    :mask-closable="false"
    :radar="{ name: 'Costume edit', desc: 'Edit the current costume with AI or adjustments' }"
    @update:visible="close"
  >
    <div class="flex flex-col">
      <div class="flex items-center justify-between gap-3 px-5 py-3">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="relative h-8 w-8 shrink-0 overflow-hidden rounded-md">
            <CheckerboardBackground class="absolute inset-0" />
            <UIImg class="h-full w-full" :src="src" :loading="false" />
          </div>
          <span class="max-w-56 truncate text-sm font-medium text-title" :title="name">{{ name }}</span>
          <span v-if="draft !== image" class="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-400">{{
            $t({ en: 'Edited', zh: '已修改' })
          }}</span>
        </div>
        <UIButton
          v-radar="{ name: 'Undo costume edit', desc: 'Undo the last edit in this panel' }"
          type="white"
          size="small"
          icon="undo"
          :disabled="draftHistory.length === 0 || busy"
          :aria-label="$t({ en: 'Undo', zh: '撤销' })"
          :title="$t({ en: 'Undo', zh: '撤销' })"
          @click="undoLast"
        />
      </div>

      <div
        class="costume-edit-preview relative mx-5 overflow-hidden rounded-lg border border-grey-300"
        :aria-busy="busy"
      >
        <CheckerboardBackground class="absolute inset-0" />
        <UIImg
          class="absolute inset-8 transition-transform duration-200"
          :src="src"
          :loading="loading"
          role="img"
          :aria-label="name"
          :style="{ transform: 'scale(' + previewZoom + ')' }"
        />
        <UIButton
          v-if="candidate != null && !busy"
          class="absolute right-3 top-3 shadow-sm"
          type="white"
          size="small"
          :aria-label="$t({ en: 'Hold to view original', zh: '按住查看原图' })"
          @pointerdown="before = true"
          @pointerup="before = false"
          @pointerleave="before = false"
          @keydown.space.prevent="before = true"
          @keyup.space.prevent="before = false"
          >{{ $t({ en: 'Hold to compare', zh: '按住查看原图' }) }}</UIButton
        >
        <div
          v-if="busy"
          class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px]"
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
        class="mt-3 flex items-center justify-center gap-2.5"
        :aria-label="$t({ en: 'Candidate previews', zh: '候选预览' })"
      >
        <CostumeEditVariant
          v-for="(variant, index) in variants"
          :key="index"
          :image="variant"
          :index="index"
          :selected="candidate === variant"
          :disabled="busy"
          @click="selectVariant(variant)"
        />
      </div>

      <div class="px-5 pt-4">
        <div v-if="candidate == null" class="flex justify-center">
          <div
            class="inline-flex items-center gap-0.5 rounded-full bg-grey-100 p-1"
            role="tablist"
            :aria-label="$t({ en: 'Editing tools', zh: '编辑工具' })"
          >
            <button
              v-for="item in modules"
              :key="item.value"
              v-radar="{ name: item.label.en, desc: 'Switch to the ' + item.label.en + ' tool' }"
              type="button"
              role="tab"
              :aria-selected="activeModule === item.value"
              class="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all duration-150"
              :class="
                activeModule === item.value
                  ? 'bg-white font-medium text-title shadow-sm'
                  : 'text-grey-700 hover:text-grey-1000'
              "
              @click="switchModule(item.value)"
            >
              <UIIcon :type="item.icon" class="h-4 w-4" />
              {{ $t(item.label) }}
            </button>
          </div>
        </div>

        <div class="pt-4 pb-1">
          <template v-if="candidate == null && activeModule === 'ai'">
            <UIForm :form="form" @submit="generate()">
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
            </UIForm>
            <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
              <UIButton
                v-for="example in examples"
                :key="example.en"
                v-radar="{ name: example.en, desc: 'Fill in an example modification instruction' }"
                type="white"
                size="small"
                :disabled="busy"
                @click="chooseExample($t(example))"
                >{{ $t(example) }}</UIButton
              >
              <UIButton
                v-radar="{ name: 'Generate edit preview', desc: 'Generate a preview without changing the costume' }"
                class="ml-auto"
                type="primary"
                icon="arrowUp"
                :disabled="instruction.trim() === ''"
                :loading="busy"
                @click="generate()"
                >{{ $t({ en: 'Generate', zh: '生成' }) }}</UIButton
              >
            </div>
            <p class="mt-2 text-center text-xs text-grey-600">
              {{
                $t({
                  en: 'Prototype preview · Local image effects, AI not connected, no credits used',
                  zh: '原型预览 · 本地图像效果，未接入 AI，不消耗额度'
                })
              }}
            </p>
          </template>

          <div v-else-if="candidate == null" class="flex flex-col gap-5 py-1">
            <div class="flex items-center gap-4">
              <span class="flex w-16 shrink-0 items-center gap-1.5 text-sm font-medium text-title">
                <UIIcon type="resize" class="h-4 w-4 text-grey-700" />
                {{ $t({ en: 'Scale', zh: '缩放' }) }}
              </span>
              <UISlider
                :value="scale"
                :min="25"
                :max="200"
                :step="1"
                :disabled="busy"
                update-on="input"
                @update:value="scale = $event"
              />
              <span class="w-11 shrink-0 text-right text-sm tabular-nums text-title">{{ scale }}%</span>
            </div>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                v-radar="{ name: 'Reset scale', desc: 'Reset the scale to 100%' }"
                type="button"
                class="text-sm text-primary-400 transition-opacity hover:opacity-80 disabled:opacity-40"
                :disabled="busy || scale === 100"
                @click="scale = 100"
              >
                {{ $t({ en: 'Reset', zh: '重置' }) }}
              </button>
              <UIButton
                v-radar="{ name: 'Apply costume scale', desc: 'Apply the scale to the working draft' }"
                type="primary"
                size="small"
                :disabled="busy || scale === 100"
                @click="applyScale"
                >{{ $t({ en: 'Apply', zh: '应用' }) }}</UIButton
              >
            </div>
          </div>

          <div v-else class="flex flex-col gap-3 py-1" role="status" aria-live="polite">
            <div class="flex items-center justify-between gap-3">
              <p class="min-w-0 truncate font-medium text-title">{{ instruction }}</p>
              <span class="shrink-0 text-xs text-grey-600">{{ $t({ en: 'Not applied yet', zh: '尚未采用' }) }}</span>
            </div>
            <div class="flex flex-wrap justify-end gap-2">
              <UIButton type="white" size="small" :disabled="busy" @click="discardCandidate">{{
                $t({ en: 'Discard', zh: '放弃' })
              }}</UIButton>
              <UIButton type="secondary" size="small" :disabled="busy" @click="generate(true)">{{
                $t({ en: 'Try again', zh: '再试一次' })
              }}</UIButton>
              <UIButton
                v-radar="{ name: 'Keep costume edit', desc: 'Keep this version and continue editing' }"
                type="primary"
                size="small"
                :disabled="busy"
                @click="keepCandidate"
                >{{ $t({ en: 'Keep', zh: '保留' }) }}</UIButton
              >
            </div>
          </div>

          <p v-if="error !== ''" class="mt-2 flex items-center gap-1.5 text-sm text-red-500" role="alert">
            <UIIcon type="error" class="h-4 w-4 shrink-0" />
            {{ error }}
          </p>
        </div>
      </div>

      <footer class="flex items-center justify-between border-t border-grey-300 px-5 py-3.5">
        <UIButton
          v-radar="{ name: 'Cancel costume edit', desc: 'Close without changing the costume' }"
          type="neutral"
          @click="close"
          >{{ $t({ en: 'Cancel', zh: '取消' }) }}</UIButton
        >
        <UIButton
          v-radar="{ name: 'Finish costume edit', desc: 'Apply all edits and close' }"
          type="primary"
          :disabled="busy"
          @click="finish"
          >{{ $t({ en: 'Done', zh: '完成' }) }}</UIButton
        >
      </footer>
    </div>
  </UIFormModal>
</template>

<style scoped>
.costume-edit-preview {
  height: clamp(220px, 38vh, 380px);
}
</style>
