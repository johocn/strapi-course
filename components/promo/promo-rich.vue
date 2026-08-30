<template>
  <view class="promo-card promo-rich">
    <rich-text class="rich-body" :nodes="nodes" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  activity?: any
  config?: any
}>()

const nodes = computed(() => props.config?.html || props.activity?.description || '')
</script>

<style lang="scss" scoped>
.rich-body {
  font-size: 28rpx;
  color: var(--c-text);
  line-height: 1.7;
}
</style>
