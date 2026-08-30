<template>
  <view class="promo-card promo-images">
    <text v-if="title" class="section-title">{{ title }}</text>
    <view v-if="images.length" class="image-grid">
      <image
        v-for="(src, index) in images"
        :key="index"
        :src="src"
        mode="aspectFill"
        class="grid-image"
        lazy-load
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveMediaUrl } from '../../utils/env'

const props = defineProps<{
  activity?: any
  config?: any
}>()

const title = computed(() => props.config?.title || '')
const images = computed<string[]>(() => (props.config?.images || []).map((m: any) => resolveMediaUrl(m)))
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 20rpx;
}

.image-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.grid-image {
  width: 48%;
  height: 240rpx;
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  background: var(--c-card);
}
</style>
