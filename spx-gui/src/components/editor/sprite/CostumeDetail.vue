<template>
  <EditorItemDetail :name="costume.name" @rename="emit('rename')">
    <template v-if="edit != null" #actions>
      <UIButton
        v-radar="{ name: 'Edit costume', desc: 'Modify the current costume with an instruction' }"
        type="secondary"
        size="small"
        @click="edit(costume)"
        >{{ $t({ en: 'Modify...', zh: '修改...' }) }}</UIButton
      >
    </template>
    <div class="relative flex-1 overflow-hidden rounded-sm w-full">
      <CheckerboardBackground class="absolute inset-0" />
      <UIImg class="h-full w-full" :src="imgSrc" :loading="imgLoading" />
    </div>
  </EditorItemDetail>
</template>

<script setup lang="ts">
import { UIImg, UIButton } from '@/components/ui'
import { useRenderableImageUrl } from '@/utils/img-rendering'
import type { Costume } from '@/models/spx/costume'
import EditorItemDetail from '../common/EditorItemDetail.vue'
import CheckerboardBackground from './CheckerboardBackground.vue'

const props = defineProps<{
  costume: Costume
  edit?: (costume: Costume) => Promise<void>
}>()

const emit = defineEmits<{
  rename: []
}>()

const [imgSrc, imgLoading] = useRenderableImageUrl(() => props.costume.img)
</script>
