<template>
  <view class="page-container">
    <view class="list-top">
      <text class="top-title">线下活动</text>
      <view class="top-cal" @click="goCalendar">📅 日历</view>
    </view>
    <view class="filter-bar">
      <scroll-view scroll-x class="cat-scroll">
        <view
          class="cat-chip"
          :class="{ active: activeCategory === '' }"
          @click="onCategory('')">全部</view>
        <view
          v-for="c in categories"
          :key="c"
          class="cat-chip"
          :class="{ active: activeCategory === c }"
          @click="onCategory(c)">{{ c }}</view>
      </scroll-view>
      <input
        v-model="keyword"
        class="search-input"
        type="text"
        placeholder="搜索活动标题"
        confirm-type="search"
        @confirm="onSearch" />
    </view>
    <view v-if="!canUse" class="empty-state">
      <text class="empty-icon">🎪</text>
      <text class="empty-text">未授权或未开启</text>
    </view>
    <view v-else class="activity-list">
      <view
        v-for="item in activities"
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

    <view v-if="canUse && activities.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">🎪</text>
      <text class="empty-text">暂无线下活动</text>
    </view>

    <view v-if="canUse && loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listActivities, getActivityCategories } from '../../services/api'
import { fetchAuthConfig, getStoredAuthConfig } from '../../services/auth-config'

const activities = ref<any[]>([])
const loading = ref(false)
const categories = ref<string[]>([])
const activeCategory = ref('')
const keyword = ref('')
const canUse = ref(true)

function applyActivityGate() {
  const cfg = getStoredAuthConfig()
  canUse.value = !cfg || (cfg.activity !== false && cfg.moduleGranted?.activity !== false)
}

function onCategory(c: string) {
  activeCategory.value = c
  loadActivities()
}
function onSearch() {
  loadActivities()
}

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
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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

function goCalendar() {
  uni.navigateTo({ url: '/pages/activity/calendar' })
}

async function loadActivities() {
  if (!canUse.value) return
  loading.value = true
  try {
    const res = await listActivities({
      pageSize: 50,
      category: activeCategory.value || undefined,
      search: keyword.value.trim() || undefined,
    })
    const data = (res as any)?.data ?? res
    activities.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('加载活动列表失败', e)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    const res = (await getActivityCategories()) as any
    categories.value = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
  } catch (e) {
    console.error('加载分类失败', e)
  }
}

onMounted(async () => {
  applyActivityGate()
  const cfg = await fetchAuthConfig()
  if (cfg) {
    canUse.value = cfg.activity !== false && cfg.moduleGranted?.activity !== false
  }
  loadActivities()
  loadCategories()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.list-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.top-title { font-size: 34rpx; font-weight: 600; color: #333; }
.top-cal { font-size: 28rpx; color: #667eea; padding: 8rpx 16rpx; }

.filter-bar { margin-bottom: 20rpx; }
.cat-scroll { display: flex; white-space: nowrap; margin-bottom: 16rpx; }
.cat-chip {
  display: inline-block; padding: 10rpx 26rpx; margin-right: 16rpx;
  background: #fff; color: #666; font-size: 26rpx; border-radius: 30rpx;
  &.active { background: #667eea; color: #fff; }
}
.search-input {
  background: #fff; border-radius: 30rpx; padding: 14rpx 24rpx;
  font-size: 26rpx; color: #333;
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

.loading-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}
</style>