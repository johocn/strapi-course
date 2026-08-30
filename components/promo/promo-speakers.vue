<template>
  <view class="promo-card promo-speakers">
    <text class="section-title">嘉宾介绍</text>
    <view v-if="speakers.length" class="speaker-list">
      <view v-for="(s, index) in speakers" :key="index" class="speaker-item">
        <image v-if="avatarOf(s)" :src="avatarOf(s)" mode="aspectFill" class="speaker-avatar" />
        <view v-else class="speaker-avatar speaker-avatar--placeholder">👤</view>
        <view class="speaker-body">
          <text class="speaker-name">{{ s.name || '嘉宾' }}</text>
          <text v-if="s.bio || s.desc" class="speaker-bio">{{ s.bio || s.desc }}</text>
          <view v-if="s.tags?.length" class="speaker-tags">
            <text v-for="(tag, ti) in s.tags" :key="ti" class="speaker-tag">{{ tag }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="speaker-empty">暂无嘉宾</view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveMediaUrl } from '../../utils/env'

const props = defineProps<{
  activity?: any
  config?: any
}>()

const speakers = computed<any[]>(() => {
  const l = props.activity?.lecturer
  if (!l) return []
  return Array.isArray(l) ? l : [l]
})

function avatarOf(speaker: any): string {
  return resolveMediaUrl(speaker?.avatar || speaker?.image || speaker?.photo)
}
</script>

<style lang="scss" scoped>
.section-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: var(--c-text);
  margin-bottom: 20rpx;
}

.speaker-list {
  display: flex;
  flex-direction: column;
}

.speaker-item {
  display: flex;
  align-items: flex-start;
  padding: 14rpx 0;
}

.speaker-avatar {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  margin-right: 20rpx;
  border-radius: 50%;
  background: var(--c-card);
}

.speaker-avatar--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
}

.speaker-body {
  flex: 1;
}

.speaker-name {
  display: block;
  font-size: 30rpx;
  font-weight: bold;
  color: var(--c-text);
}

.speaker-bio {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  color: var(--c-text-dim);
  line-height: 1.5;
}

.speaker-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.speaker-tag {
  padding: 4rpx 16rpx;
  font-size: 22rpx;
  border-radius: 8rpx;
  background: var(--c-primary);
  color: #fff;
}

.speaker-empty {
  padding: 30rpx 0;
  font-size: 26rpx;
  color: var(--c-text-dim);
  text-align: center;
}
</style>
