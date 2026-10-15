<template>
  <EditorItemDetail :name="costume.name" @rename="emit('rename')">
    <div class="relative flex-1 overflow-hidden rounded-sm w-full">
      <CheckerboardBackground class="absolute inset-0" />
      <UIImg class="h-full w-full" :src="imgSrc" :loading="imgLoading" />
      <UIButton
        v-if="edit != null"
        v-radar="{ name: 'Edit costume', desc: 'Edit this costume with AI or adjustments' }"
        class="absolute right-3 bottom-3"
        type="secondary"
        size="small"
        icon="edit"
        @click="edit(costume)"
        >{{ $t({ en: 'Edit', zh: '编辑' }) }}</UIButton
      >
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
