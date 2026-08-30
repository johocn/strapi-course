<template>
  <view class="promo-card promo-highlights">
    <text v-if="title" class="section-title">{{ title }}</text>
    <view v-if="points.length" class="points-list">
      <view v-for="(point, index) in points" :key="index" class="point-item">
        <text class="point-mark">✓</text>
        <text class="point-text">{{ point }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  activity?: any
  config?: any
}>()

const title = computed(() => props.config?.title || '')
const points = computed<string[]>(() => props.config?.points || [])
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 20rpx;
}

.points-list {
  display: flex;
  flex-direction: column;
}

.point-item {
  display: flex;
  align-items: flex-start;
  padding: 10rpx 0;
}

.point-mark {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  margin-top: 4rpx;
  margin-right: 14rpx;
  border-radius: 50%;
  background: var(--c-primary);
  color: #fff;
  font-size: 24rpx;
  line-height: 36rpx;
  text-align: center;
}

.point-text {
  flex: 1;
  font-size: 28rpx;
  color: var(--c-text);
  line-height: 1.6;
}
</style>
