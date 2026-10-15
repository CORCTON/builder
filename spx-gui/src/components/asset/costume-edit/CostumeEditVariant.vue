<script setup lang="ts">
import { useRenderableImageUrl } from '@/utils/img-rendering'
import type { File } from '@/models/common/file'
import { UIButton, UIImg } from '@/components/ui'

const props = defineProps<{ image: File; index: number; selected: boolean; disabled: boolean }>()
defineEmits<{ click: [] }>()
const [src, loading] = useRenderableImageUrl(() => props.image)
</script>

<template>
  <UIButton
    v-radar="{ name: `Candidate ${index + 1}`, desc: 'Compare a previous candidate from this round' }"
    type="white"
    class="h-12! w-12! p-1!"
    :disabled="disabled"
    :aria-pressed="selected"
    :aria-label="$t({ en: `Preview ${index + 1}`, zh: `候选 ${index + 1}` })"
    :class="selected ? 'ring-2 ring-primary-500' : ''"
    @click="$emit('click')"
    ><UIImg class="h-full w-full" :src="src" :loading="loading"
  /></UIButton>
</template>
