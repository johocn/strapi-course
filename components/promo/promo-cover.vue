<template>
  <view
    class="promo-card promo-cover"
    :class="bgImage ? 'promo-cover--image' : 'promo-cover--gradient'"
  >
    <image v-if="bgImage" :src="bgImage" mode="aspectFill" class="cover-bg" />
    <view v-if="bgImage" class="cover-mask" />
    <view class="cover-content">
      <text class="cover-title">{{ title }}</text>
      <text v-if="subtitle" class="cover-subtitle">{{ subtitle }}</text>
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

const title = computed(() => props.config?.title || props.activity?.title || '')
const subtitle = computed(() => props.config?.subtitle || '')
// 封面优先级：模块 bgImage → 宣传组图 promoAssets[0] → 旧 assets[0]
const bgImage = computed(() => {
  if (props.config?.bgImage) return resolveMediaUrl(props.config.bgImage)
  const promoAssets = Array.isArray(props.activity?.promoAssets) ? props.activity.promoAssets : []
  if (promoAssets.length && promoAssets[0]?.url) return resolveMediaUrl(promoAssets[0].url)
  const legacy = Array.isArray(props.activity?.assets) ? props.activity.assets : []
  if (legacy.length && legacy[0]?.url) return resolveMediaUrl(legacy[0].url)
  return ''
})
</script>

<style lang="scss" scoped>
.promo-card.promo-cover {
  position: relative;
  height: 340rpx;
  padding: 0;
  margin: 0 0 24rpx;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
}

.promo-cover--gradient {
  background: linear-gradient(135deg, var(--c-primary) 0%, var(--c-accent) 100%);
}

.cover-bg {
  width: 100%;
  height: 100%;
}

.cover-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
}

.cover-content {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 40rpx;
  padding: 0 40rpx;
}

.cover-title {
  display: block;
  font-size: 44rpx;
  font-weight: bold;
  color: #fff;
  line-height: 1.4;
}

.cover-subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.5;
}
</style>
