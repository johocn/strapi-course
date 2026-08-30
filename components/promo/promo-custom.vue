<template>
  <view class="promo-card promo-custom">
    <text v-if="title" class="section-title">{{ title }}</text>
    <rich-text v-if="html" class="custom-html" :nodes="html" />
    <view v-if="images.length" class="custom-images">
      <image
        v-for="(src, index) in images"
        :key="index"
        :src="src"
        mode="aspectFill"
        class="custom-image"
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
const html = computed(() => props.config?.html || '')
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

.custom-html {
  font-size: 28rpx;
  color: var(--c-text);
  line-height: 1.7;
}

.custom-images {
  display: flex;
  flex-direction: column;
  margin-top: 20rpx;
}

.custom-image {
  width: 100%;
  height: 320rpx;
  margin-bottom: 16rpx;
  border-radius: 12rpx;
  background: var(--c-card);
}
</style>
