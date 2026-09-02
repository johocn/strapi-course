<template>
  <view class="promo-card promo-info">
    <view v-if="statusBadge" class="status-badge">{{ statusBadge }}</view>
    <view v-if="timeText" class="info-item">
      <text class="info-icon">🕐</text>
      <view class="info-body">
        <text class="info-label">活动时间</text>
        <text class="info-value">{{ timeText }}</text>
      </view>
    </view>
    <view v-if="venueName" class="info-item">
      <text class="info-icon">📍</text>
      <view class="info-body">
        <text class="info-label">活动地点</text>
        <text class="info-value">{{ venueName }}</text>
      </view>
    </view>
    <view v-if="quotaText" class="info-item">
      <text class="info-icon">👥</text>
      <view class="info-body">
        <text class="info-label">活动名额</text>
        <text class="info-value">{{ quotaText }}</text>
      </view>
    </view>
    <view v-if="feeText" class="info-item">
      <text class="info-icon">🎟️</text>
      <view class="info-body">
        <text class="info-label">活动费用</text>
        <text class="info-value">{{ feeText }}</text>
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

function formatTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN')
}

const timeText = computed(() => {
  const a = props.activity
  const start = formatTime(a?.startTime)
  const end = formatTime(a?.endTime)
  if (start && end) return `${start} ~ ${end}`
  return start || end
})

const venueName = computed(() => props.activity?.venue?.name || props.activity?.venueName || '')

const quotaText = computed(() => {
  const a = props.activity
  if (a?.capacity == null) return ''
  return `${a.usedCapacity ?? 0} / ${a.capacity}`
})

const feeText = computed(() => {
  const a = props.activity
  if (!a || a.pricingMode === 'free') return ''
  const cost = Number(a.cost ?? a.cashPrice ?? 0)
  if (cost <= 0) return '免费'
  return `${cost}元`
})

const statusBadge = computed(() => {
  const s = props.activity?.status
  if (s === 'ended' || s === 'archived') return '已结束'
  if (s === 'draft') return '未发布'
  return ''
})
</script>

<style lang="scss" scoped>
.promo-info {
  position: relative;
}

.status-badge {
  position: absolute;
  top: 28rpx;
  right: 28rpx;
  padding: 4rpx 16rpx;
  font-size: 22rpx;
  border-radius: 8rpx;
  background: var(--c-primary);
  color: #fff;
}

.info-item {
  display: flex;
  align-items: flex-start;
  padding: 12rpx 0;
}

.info-icon {
  font-size: 30rpx;
  line-height: 1.4;
  margin-right: 16rpx;
}

.info-body {
  flex: 1;
}

.info-label {
  display: block;
  font-size: 24rpx;
  color: var(--c-text-dim);
  margin-bottom: 4rpx;
}

.info-value {
  display: block;
  font-size: 28rpx;
  color: var(--c-text);
  line-height: 1.5;
}
</style>
