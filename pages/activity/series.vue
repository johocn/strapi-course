<template>
  <view class="page-container">
    <view v-if="series" class="series-wrap">
      <!-- 系列信息 -->
      <view class="series-head">
        <image v-if="series.cover" :src="series.cover" class="series-cover" mode="aspectFill" />
        <text class="series-title">{{ series.title }}</text>
        <text v-if="series.description" class="series-desc">{{ series.description }}</text>
      </view>

      <!-- 场次列表 -->
      <view class="section-title">场次</view>
      <view class="activity-list">
        <view
          v-for="item in series.activities || []"
          :key="item.documentId || item.id"
          class="activity-item"
          @click="goDetail(item)"
        >
          <view class="item-top">
            <text class="item-title">{{ item.title }}</text>
            <text :class="['status-tag', `status-${item.status}`]">{{ statusText(item.status) }}</text>
          </view>
          <view class="item-venue">
            <text class="venue-icon">📍</text>
            <text class="venue-name">{{ item.venueName || '待定场地' }}</text>
          </view>
          <view class="item-time">
            <text class="time-label">时间</text>
            <text class="time-value">{{ formatTime(item.startTime) }} ~ {{ formatTime(item.endTime) }}</text>
          </view>
          <view v-if="item.capacity" class="item-progress">
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: progressPercent(item) }"></view>
            </view>
            <text class="progress-text">{{ usedCapacity(item) }}/{{ item.capacity }} 已报名</text>
          </view>
        </view>
      </view>

      <view v-if="!series.activities || series.activities.length === 0" class="empty-state">
        <text class="empty-icon">🎪</text>
        <text class="empty-text">本系列暂无场次</text>
      </view>
    </view>

    <view v-if="!series && loading" class="loading-state"><text>加载中...</text></view>
    <view v-if="!series && !loading" class="loading-state"><text>系列不存在或已下架</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getSeries } from '../../services/api'
import { setupPageShare } from '../../utils/share'

const series = ref<any>(null)
const loading = ref(false)

function statusText(status: string): string {
  const map: Record<string, string> = {
    draft: '未开放',
    signup_open: '报名中',
    ongoing: '进行中',
    ended: '已结束',
  }
  return map[status] ?? status ?? ''
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function usedCapacity(item: any): number {
  return item.usedCapacity ?? 0
}

function progressPercent(item: any): string {
  const cap = item.capacity
  if (!cap) return '0%'
  const used = Math.min(usedCapacity(item), cap)
  return `${Math.round((used / cap) * 100)}%`
}

function goDetail(item: any) {
  const id = item.documentId || item.id
  uni.navigateTo({ url: `/pages/activity/detail?id=${id}` })
}

async function loadSeries(id: string) {
  if (!id) return
  loading.value = true
  try {
    series.value = (await getSeries(id)) ?? null
  } catch (e) {
    console.error('加载活动系列失败', e)
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  const id = (options as any)?.id || ''
  loadSeries(id)
  setupPageShare({ title: '活动系列' })
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.series-wrap {
}

.series-head {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.series-cover {
  width: 100%;
  height: 320rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
  margin-bottom: 20rpx;
}

.series-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.series-desc {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: #666;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin: 10rpx 0 20rpx;
}

.activity-list {
}

.activity-item {
  background: #fff;
  padding: 28rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.item-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.status-tag {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  white-space: nowrap;

  &.status-signup_open {
    background: #e6f7ff;
    color: #1890ff;
  }
  &.status-ongoing {
    background: #f6ffed;
    color: #52c41a;
  }
  &.status-ended {
    background: #f5f5f5;
    color: #999;
  }
  &.status-draft {
    background: #f0f0f0;
    color: #bbb;
  }
}

.item-venue {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.venue-icon {
  font-size: 26rpx;
  margin-right: 8rpx;
}

.venue-name {
  font-size: 26rpx;
  color: #666;
}

.item-time {
  display: flex;
  align-items: center;
  margin-top: 12rpx;
}

.time-label {
  font-size: 24rpx;
  color: #999;
  margin-right: 12rpx;
}

.time-value {
  font-size: 24rpx;
  color: #666;
}

.item-progress {
  margin-top: 18rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.progress-bar {
  flex: 1;
  height: 12rpx;
  background: #f0f0f0;
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 6rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.progress-text {
  font-size: 22rpx;
  color: #999;
  white-space: nowrap;
}

.empty-state {
  padding: 120rpx 30rpx;
  text-align: center;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}

.loading-state {
  padding: 120rpx 30rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}
</style>