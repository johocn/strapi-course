<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="back-btn" @click="goBack">←</text>
        <text class="header-title">积分记录</text>
      </view>
    </view>

    <view class="stats-card">
      <view class="stat-item">
        <text class="stat-value earn">{{ stats.totalEarned }}</text>
        <text class="stat-label">累计获得</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value spend">{{ stats.totalSpent }}</text>
        <text class="stat-label">累计消费</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value balance">{{ stats.balance }}</text>
        <text class="stat-label">当前余额</text>
      </view>
    </view>

    <view class="filter-tabs">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        :class="['filter-tab', { active: activeTab === tab.value }]"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <view class="record-list">
      <view
        v-for="record in records"
        :key="record.id"
        class="record-item"
      >
        <view :class="['record-icon', record.type === 'increase' ? 'earn' : 'spend']">
          <text>{{ record.type === 'increase' ? '+' : '-' }}</text>
        </view>
        <view class="record-info">
          <text class="record-desc">{{ getActionLabel(record) }}</text>
          <text class="record-time">{{ formatTime(record.createdAt) }}</text>
        </view>
        <view :class="['record-amount', record.type === 'increase' ? 'earn' : 'spend']">
          <text>{{ record.type === 'increase' ? '+' : '-' }}{{ record.points }}</text>
        </view>
      </view>
    </view>

    <view v-if="records.length === 0 && !loading" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">暂无积分记录</text>
    </view>

    <view v-if="loading" class="loading-more">
      <text>加载中...</text>
    </view>

    <view v-else-if="hasMore && records.length > 0" class="load-more" @click="loadMore">
      <text>加载更多</text>
    </view>

    <view v-else-if="!hasMore && records.length > 0" class="no-more">
      <text>没有更多了</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPointBalance, getPointRecordList, getPointStatistics } from '../../services/api'
import { validateLogin } from '../../utils/auth'
import { getStoredAuthConfig } from '../../services/auth-config'

interface RecordItem {
  id: number
  documentId: string
  action: string
  type: string
  points: number
  balance: number
  source: string
  method: string
  remark: string
  createdAt: string
}

const siteConfig = getStoredAuthConfig()
const stats = ref({ totalEarned: 0, totalSpent: 0, balance: 0 })
const records = ref<RecordItem[]>([])
const activeTab = ref('all')
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)

const tabs = [
  { label: '全部', value: 'all' },
  { label: '收入', value: 'increase' },
  { label: '支出', value: 'decrease' },
]

const hasMore = ref(true)

const actionLabels: Record<string, string> = {
  quiz_pass: '答题获得',
  complete_lesson: '完成课时',
  complete_quiz: '完成答题',
  daily_sign_in: '每日签到',
  sign_in: '签到',
  redeem: '兑换消费',
  admin_adjust: '管理员调整',
}

function getActionLabel(record: RecordItem) {
  if (record.remark) return record.remark
  return actionLabels[record.action] ?? record.action
}

function switchTab(tab: string) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  page.value = 1
  records.value = []
  hasMore.value = true
  loadRecords()
}

async function loadStats() {
  try {
    const [balanceRes, statsRes] = await Promise.all([
      getPointBalance(),
      getPointStatistics(),
    ])
    stats.value = {
      totalEarned: (statsRes as any)?.totalEarned ?? 0,
      totalSpent: (statsRes as any)?.totalSpent ?? 0,
      balance: (balanceRes as any)?.balance ?? 0,
    }
  } catch (e) { console.error('[points-record] loadStats failed:', e) }
}

async function loadRecords(append = false) {
  if (loading.value) return
  loading.value = true

  try {
    const params: any = { page: page.value, pageSize }
    if (activeTab.value !== 'all') {
      params.type = activeTab.value
    }
    const res = await getPointRecordList(params)
    const data = (res as any)?.data ?? {}
    const list: RecordItem[] = data.records ?? []
    total.value = data.total ?? 0

    if (append) {
      records.value = [...records.value, ...list]
    } else {
      records.value = list
    }
    hasMore.value = records.value.length < total.value
  } catch (e) {
    console.error('加载记录失败', e)
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  page.value++
  loadRecords(true)
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const m = date.getMonth() + 1
  const d = date.getDate()
  const h = date.getHours()
  const min = date.getMinutes().toString().padStart(2, '0')
  return `${m}月${d}日 ${h}:${min}`
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/profile' })
  }
}

function checkLoginStatus() {
  if (!validateLogin()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/login' }) }, 1500)
    return false
  }
  return true
}

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '积分记录' })
  // #endif
  if (checkLoginStatus()) {
    loadStats()
    loadRecords()
  }
})

onShow(() => {
  if (checkLoginStatus()) {
    loadStats()
    loadRecords()
  }
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.header {
  position: relative;
  padding: 40rpx 30rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.back-btn {
  color: #fff;
  font-size: 32rpx;
  margin-right: 20rpx;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.stats-card {
  display: flex;
  margin: -30rpx 30rpx 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.stat-item {
  flex: 1;
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 40rpx;
  font-weight: bold;

  &.earn { color: #52c41a; }
  &.spend { color: #ff4d4f; }
  &.balance { color: #667eea; }
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
}

.stat-divider {
  width: 1rpx;
  background: #eee;
  margin: 0 20rpx;
}

.filter-tabs {
  display: flex;
  padding: 20rpx 30rpx;
  gap: 20rpx;
}

.filter-tab {
  flex: 1;
  text-align: center;
  padding: 20rpx;
  background: #fff;
  border-radius: 30rpx;
  font-size: 28rpx;
  color: #666;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.record-list {
  padding: 0 30rpx;
}

.record-item {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 25rpx;
  border-radius: 16rpx;
  margin-bottom: 15rpx;
}

.record-icon {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;

  &.earn {
    background: #f6ffed;
    color: #52c41a;
  }
  &.spend {
    background: #fff2f0;
    color: #ff4d4f;
  }
}

.record-info {
  flex: 1;
  padding: 0 20rpx;
}

.record-desc {
  display: block;
  font-size: 28rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-time {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
}

.record-amount {
  font-size: 32rpx;
  font-weight: bold;
  white-space: nowrap;

  &.earn { color: #52c41a; }
  &.spend { color: #ff4d4f; }
}

.empty-state {
  padding: 100rpx 30rpx;
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

.loading-more,
.load-more,
.no-more {
  text-align: center;
  padding: 30rpx;
  font-size: 26rpx;
  color: #999;
}

.load-more {
  color: #667eea;
}
</style>
