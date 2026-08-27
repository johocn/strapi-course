<template>
  <view class="page-container">
    <view class="tabs">
      <view :class="['tab', { active: curTab === 'all' }]" @click="switchTab('all')">
        <text>全部</text>
      </view>
      <view :class="['tab', { active: curTab === 'unread' }]" @click="switchTab('unread')">
        <text>未读<text v-if="unreadCount" class="unread-num">{{ unreadCount }}</text></text>
      </view>
    </view>

    <view class="notice-list">
      <view
        v-for="item in list"
        :key="item.id"
        :class="['notice-item', { unread: !item.readAt }]"
        @click="onTap(item)"
      >
        <view class="notice-top">
          <text class="notice-title">{{ titleOf(item) }}</text>
          <text class="notice-time">{{ formatTime(item.sentAt) }}</text>
        </view>
        <text class="notice-body">{{ bodyOf(item) }}</text>
      </view>
    </view>

    <view v-if="!loading && list.length === 0" class="empty-state">
      <text class="empty-icon">🔔</text>
      <text class="empty-text">暂无消息</text>
    </view>
    <view v-if="loading" class="loading-more"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { myNotices, markNoticeRead } from '../../services/api'
import { getToken } from '../../utils/storage'
import { setupPageShare } from '../../utils/share'

const curTab = ref<'all' | 'unread'>('all')
const list = ref<any[]>([])
const unreadCount = ref(0)
const loading = ref(false)

const SCENE_TITLES: Record<string, string> = {
  'activity.confirm': '报名成功',
  'activity.before': '活动提醒',
  'activity.waitlisted': '候补通知',
  'activity.promoted': '候补转正',
  'activity.cancelled': '报名取消',
}

function titleOf(item: any): string {
  return SCENE_TITLES[item.scene] ?? item.scene ?? '通知'
}

function bodyOf(item: any): string {
  const p = item.params && typeof item.params === 'object' ? item.params : {}
  const name = p.name ?? ''
  switch (item.scene) {
    case 'activity.confirm':
      return name ? `您已成功报名「${name}」，请按时到场` : '您已成功报名，请按时到场'
    case 'activity.before':
      return name ? `活动「${name}」即将开始，别忘了参加` : '您报名的活动即将开始'
    case 'activity.waitlisted':
      return name ? `活动「${name}」已满员，您已进入候补（第${p.position ?? '—'}位）` : '活动已满员，已进入候补'
    case 'activity.promoted':
      return name ? `活动「${name}」有名额空出，您已候补转正` : '您已候补转正，请按时到场'
    case 'activity.cancelled':
      return name ? `您已取消报名「${name}」` : '您已取消报名'
    default:
      return item.scene ?? ''
  }
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function switchTab(t: 'all' | 'unread') {
  if (curTab.value === t) return
  curTab.value = t
  loadList()
}

async function loadList() {
  if (!getToken()) return
  loading.value = true
  try {
    const res = await myNotices({
      page: 1,
      pageSize: 50,
      unreadOnly: curTab.value === 'unread',
    })
    const data = res ?? {}
    list.value = Array.isArray(data.list) ? data.list : []
    unreadCount.value = Number(data.unreadCount ?? 0)
  } catch (e) {
    console.error('加载消息失败', e)
  } finally {
    loading.value = false
  }
}

async function onTap(item: any) {
  // 已读则直接处理，未读先标记已读并刷新
  if (item.link) {
    uni.navigateTo({ url: item.link })
  }
  if (item.readAt) return
  try {
    await markNoticeRead(item.id)
    const idx = list.value.findIndex((x) => x.id === item.id)
    if (idx >= 0) list.value[idx].readAt = new Date().toISOString()
    if (unreadCount.value > 0) unreadCount.value -= 1
  } catch (e) {
    console.error('标记已读失败', e)
  }
}

onShow(() => {
  loadList()
  setupPageShare({ title: '消息通知' })
})

onPullDownRefresh(async () => {
  await loadList()
  uni.stopPullDownRefresh()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx 30rpx 40rpx;
}

.tabs {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.tab {
  flex: 1;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #666;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-weight: bold;
  }
}

.unread-num {
  display: inline-block;
  margin-left: 8rpx;
  min-width: 32rpx;
  padding: 0 8rpx;
  height: 32rpx;
  line-height: 32rpx;
  border-radius: 16rpx;
  background: #f04141;
  color: #fff;
  font-size: 22rpx;
  text-align: center;
}

.notice-item {
  background: #fff;
  padding: 28rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  border-left: 6rpx solid transparent;

  &.unread {
    border-left-color: #667eea;
    background: #fafbff;
  }
}

.notice-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.notice-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.notice-time {
  flex-shrink: 0;
  font-size: 22rpx;
  color: #999;
}

.notice-body {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-top: 14rpx;
  line-height: 1.5;
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