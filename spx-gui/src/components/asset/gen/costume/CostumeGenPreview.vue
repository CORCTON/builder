<script lang="ts" setup>
import { computed } from 'vue'
import { useMessageHandle } from '@/utils/exception'
import { useRenderableImageUrl } from '@/utils/img-rendering'
import { humanizeTimeLeft } from '../common/time-left'
import type { Costume } from '@/models/spx/costume'
import type { CostumeGen } from '@/models/spx/gen/costume-gen'
import { UIImg, UIButton, UIError, useModal } from '@/components/ui'
import CostumeEditModal from '@/components/asset/costume-edit/CostumeEditModal.vue'
import { useEditorCtxRef } from '@/components/editor/EditorContextProvider.vue'
import CostumeDetail from '@/components/editor/sprite/CostumeDetail.vue'
import { useRenameCostumeGen } from '../..'
import GenLoading from '../common/GenLoading.vue'
import GenPreview from '../common/GenPreview.vue'
import PreviewWithCheckerboardBg from '../common/PreviewWithCheckerboardBg.vue'
import GenStateFailed from '../common/GenStateFailed.vue'

const props = defineProps<{
  gen: CostumeGen
}>()

const editorCtx = useEditorCtxRef()
const editCostume = useModal(CostumeEditModal)
const handleModify = useMessageHandle(
  async (costume: Costume | null = null) => {
    const gen = props.gen
    const source = costume?.img ?? gen.image
    if (source == null) return
    const image = await editCostume({ image: source, name: costume?.name ?? gen.name })
    const apply = () => {
      if (
        props.gen !== gen ||
        (costume == null
          ? gen.image !== source || gen.result != null
          : gen.result !== costume || costume.img !== source)
      ) {
        throw new Error('The source costume has changed')
      }
      if (costume == null) gen.setImage(image)
      else costume.setImg(image)
    }
    const history = editorCtx.value?.state.history
    if (history == null) apply()
    else await history.doAction({ name: { en: 'Modify costume', zh: '修改造型' } }, apply)
  },
  {
    en: 'Could not apply the edit. Reopen the current costume and try again.',
    zh: '无法采用修改，请重新打开当前造型后再试。'
  }
).fn

const renameCostume = useRenameCostumeGen()
const handleRenameCostume = useMessageHandle(() => renameCostume(props.gen), {
  en: 'Failed to rename costume',
  zh: '重命名造型失败'
}).fn

const canSaveCostume = computed(() => {
  const { image, result } = props.gen
  if (image == null || result != null) return false
  if (imgLoading.value) return false
  return true
})

const savingCostume = computed(() => props.gen.finishState.status === 'running')

async function handleSaveCostume() {
  await props.gen.finish()
}

function handleSaveErrorBack() {
  props.gen.resetFinishState()
}

const [imgSrc, imgLoading] = useRenderableImageUrl(() => props.gen.image)
</script>

<template>
  <GenPreview v-if="gen.result == null" class="absolute inset-0" :name="gen.name" @rename="handleRenameCostume">
    <template v-if="canSaveCostume" #ops>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <UIButton type="secondary" :disabled="savingCostume" icon="edit" @click="handleModify()">{{
          $t({ en: 'Edit', zh: '编辑' })
        }}</UIButton>
        <UIButton type="green" :loading="savingCostume" @click="handleSaveCostume">{{
          $t({ en: 'Save costume', zh: '保存造型' })
        }}</UIButton>
      </div>
    </template>
    <GenLoading v-if="gen.generateState.status === 'running'">
      {{ $t({ en: 'Generating costume...', zh: '正在生成造型...' }) }}
      {{ gen.generateState.timeLeft != null ? $t(humanizeTimeLeft(gen.generateState.timeLeft)) : '' }}
    </GenLoading>
    <GenStateFailed v-else-if="gen.generateState.status === 'failed'" :state-failed="gen.generateState" />
    <GenLoading v-else-if="imgLoading">
      {{ $t({ en: 'Loading image...', zh: '正在加载图片...' }) }}
    </GenLoading>
    <PreviewWithCheckerboardBg v-else>
      <UIImg v-if="gen.image != null" class="h-full w-full" :src="imgSrc" :loading="imgLoading" />
      <GenLoading v-if="gen.finishState.status === 'running'" cover>
        {{ $t({ en: 'Saving costume...', zh: '正在保存造型...' }) }}
      </GenLoading>
      <UIError
        v-else-if="gen.finishState.status === 'failed'"
        cover
        :retry="handleSaveCostume"
        :back="handleSaveErrorBack"
      >
        {{ $t(gen.finishState.error.userMessage) }}
      </UIError>
    </PreviewWithCheckerboardBg>
  </GenPreview>
  <CostumeDetail
    v-else
    :style="{ background: 'transparent' }"
    :costume="gen.result"
    :edit="handleModify"
    @rename="handleRenameCostume"
  />
</template>
