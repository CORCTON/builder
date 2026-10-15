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
    style="width: 840px"
    body-class="p-0!"
    :title="$t({ en: 'Edit costume', zh: '编辑造型' })"
    :visible="visible"
    :auto-focus="false"
    :mask-closable="false"
    :radar="{ name: 'Costume edit prototype', desc: 'Edit the current costume with AI or adjustments' }"
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
        <UIImg
          class="absolute inset-8"
          :src="src"
          :loading="loading"
          role="img"
          :aria-label="name"
          :style="{ transform: `scale(${previewZoom})` }"
        />
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
          @click="selectVariant(variant)"
        />
      </div>

      <div class="px-6 pt-3">
        <p class="text-xs leading-relaxed text-grey-700">
          {{
            $t({
              en: 'Interaction prototype · Local image processing only, not AI editing. No credits used.',
              zh: '交互原型 · 仅演示本地图像处理，未接入 AI 编辑，不消耗额度。'
            })
          }}
        </p>
      </div>

      <div v-if="candidate == null" class="flex items-center gap-3 px-6 pt-3">
        <UIButtonGroup
          :value="activeModule"
          type="text"
          variant="secondary"
          :aria-label="$t({ en: 'Editing tools', zh: '编辑工具' })"
          @update:value="switchModule"
        >
          <UIButtonGroupItem value="ai">{{ $t({ en: 'AI edit', zh: 'AI 修改' }) }}</UIButtonGroupItem>
          <UIButtonGroupItem value="adjust">{{ $t({ en: 'Adjust', zh: '调整' }) }}</UIButtonGroupItem>
        </UIButtonGroup>
        <UIButton
          v-radar="{ name: 'Undo costume edit', desc: 'Undo the last edit in this panel' }"
          type="white"
          size="small"
          :disabled="draftHistory.length === 0 || busy"
          @click="undoLast"
          >{{ $t({ en: 'Undo', zh: '撤销' }) }}</UIButton
        >
      </div>

      <div class="px-6 pt-4 pb-4">
        <template v-if="candidate == null && activeModule === 'ai'">
          <UIForm :form="form" class="flex flex-col gap-3" @submit="generate()">
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
          <div class="mt-3 flex flex-wrap items-center gap-2">
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
              v-radar="{ name: 'Preview costume edit', desc: 'Generate a preview without changing the costume' }"
              class="ml-auto"
              type="primary"
              :disabled="instruction.trim() === ''"
              :loading="busy"
              @click="generate()"
              >{{ $t({ en: 'Preview edit', zh: '生成预览' }) }}</UIButton
            >
          </div>
        </template>

        <div v-else-if="candidate == null" class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <span class="w-20 shrink-0 text-sm font-medium text-title">{{ $t({ en: 'Scale', zh: '缩放' }) }}</span>
            <UISlider
              :value="scale"
              :min="25"
              :max="200"
              :step="1"
              :disabled="busy"
              update-on="input"
              @update:value="scale = $event"
            />
            <span class="w-12 shrink-0 text-right text-sm text-title">{{ scale }}%</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <p class="mr-auto text-sm text-grey-700">
              {{
                $t({
                  en: 'Preview scales live. Applied only after you confirm.',
                  zh: '预览会实时缩放，确认应用后才写入素材。'
                })
              }}
            </p>
            <UIButton type="white" size="small" :disabled="busy || scale === 100" @click="scale = 100">{{
              $t({ en: 'Reset', zh: '重置' })
            }}</UIButton>
            <UIButton
              v-radar="{ name: 'Apply costume scale', desc: 'Apply the scale to the working draft' }"
              type="primary"
              :disabled="busy || scale === 100"
              @click="applyScale"
              >{{ $t({ en: 'Apply scale', zh: '应用缩放' }) }}</UIButton
            >
          </div>
        </div>

        <div v-else class="flex min-h-20 flex-col justify-center gap-2" role="status" aria-live="polite">
          <p class="font-medium text-title">{{ instruction }}</p>
          <p class="text-sm text-grey-700">
            {{
              $t({
                en: 'Compare the result before you keep it. Your costume has not changed yet.',
                zh: '切换修改前后，确认是否满意。原造型还没有改变。'
              })
            }}
          </p>
          <div class="mt-2 flex flex-wrap justify-end gap-2">
            <UIButton type="white" :disabled="busy" @click="discardCandidate">{{
              $t({ en: 'Discard', zh: '放弃本次' })
            }}</UIButton>
            <UIButton type="white" :disabled="busy" @click="generate(true)">{{
              $t({ en: 'Try again', zh: '再试一次' })
            }}</UIButton>
            <UIButton
              v-radar="{ name: 'Keep costume edit', desc: 'Keep this version and continue editing' }"
              type="primary"
              :disabled="busy"
              @click="keepCandidate"
              >{{ $t({ en: 'Keep this version', zh: '保留此版' }) }}</UIButton
            >
          </div>
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
  height: clamp(200px, 35vh, 360px);
}
</style>
