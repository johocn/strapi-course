<template>
  <view class="page-container">
    <view class="record-list">
      <view
        v-for="item in records"
        :key="item.documentId || item.id"
        class="record-item"
        @click="goDetail(item)"
      >
        <view class="item-top">
          <text class="item-title">{{ item.activity?.title ?? '活动' }}</text>
          <view class="record-status">
            <text>{{ signStatusText(item) }}</text>
          </view>
        </view>
        <text class="item-time">{{ formatTime(item.activity?.startTime) }} ~ {{ formatTime(item.activity?.endTime) }}</text>
        <view class="item-venue">
          <text class="venue-icon">📍</text>
          <text class="venue-name">{{ item.activity?.venueName || '待定场地' }}</text>
        </view>
      </view>
    </view>

    <view v-if="records.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">🎪</text>
      <text class="empty-text">暂无报名记录</text>
    </view>

    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { myActivities } from '../../services/api'
import { getToken } from '../../utils/storage'

const records = ref<any[]>([])
const loading = ref(false)

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function signStatusText(item: any): string {
  const att = item.attendance
  if (att?.checkedIn) return '已签到'
  return '已报名'
}

function goDetail(item: any) {
  const actId = item.activity?.documentId || item.activity?.id
  if (!actId) return
  uni.navigateTo({ url: `/pages/activity/detail?id=${actId}` })
}

async function loadRecords() {
  // 未登录时交由 request 内部自动跳登录，这里直接请求即可
  loading.value = true
  try {
    const res = await myActivities()
    const list = (res as any)?.data ?? res
    records.value = Array.isArray(list) ? list : []
  } catch (e) {
    console.error('加载我的活动失败', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRecords()
})

onShow(() => {
  if (getToken()) loadRecords()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.record-item {
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

.record-status {
  flex-shrink: 0;
  font-size: 22rpx;
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  background: #f6ffed;
  color: #52c41a;
  white-space: nowrap;
}

.item-time {
  display: block;
  font-size: 24rpx;
  color: #666;
  margin-top: 16rpx;
}

.item-venue {
  display: flex;
  align-items: center;
  margin-top: 10rpx;
}

.venue-icon {
  font-size: 26rpx;
  margin-right: 8rpx;
}

.venue-name {
  font-size: 24rpx;
  color: #666;
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

.loading-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}
</style>