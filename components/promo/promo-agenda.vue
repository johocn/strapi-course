<template>
  <view class="promo-card promo-agenda">
    <text v-if="title" class="section-title">{{ title }}</text>
    <view v-if="items.length" class="agenda-list">
      <view v-for="(item, index) in items" :key="index" class="agenda-item">
        <view class="agenda-time">
          <text>{{ item.t }}</text>
        </view>
        <view class="agenda-track">
          <view class="agenda-dot" />
          <view class="agenda-line" />
        </view>
        <view class="agenda-body">
          <text class="agenda-title">{{ item.title }}</text>
          <text v-if="item.desc" class="agenda-desc">{{ item.desc }}</text>
        </view>
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
const items = computed<any[]>(() => props.config?.items || [])
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 20rpx;
}

.agenda-list {
  display: flex;
  flex-direction: column;
}

.agenda-item {
  display: flex;
  align-items: flex-start;
}

.agenda-time {
  flex-shrink: 0;
  width: 160rpx;
  padding-top: 4rpx;

  text {
    font-size: 24rpx;
    font-weight: bold;
    color: var(--c-primary);
  }
}

.agenda-track {
  flex-shrink: 0;
  width: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.agenda-dot {
  width: 16rpx;
  height: 16rpx;
  margin-top: 8rpx;
  border-radius: 50%;
  background: var(--c-primary);
}

.agenda-line {
  flex: 1;
  width: 2rpx;
  min-height: 24rpx;
  background: var(--c-primary);
  opacity: 0.35;
}

.agenda-item:last-child .agenda-line {
  display: none;
}

.agenda-body {
  flex: 1;
  padding-bottom: 30rpx;
}

.agenda-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: var(--c-text);
  line-height: 1.4;
}

.agenda-desc {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--c-text-dim);
  line-height: 1.5;
}
</style>
