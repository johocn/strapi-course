<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="back-btn" @click="goBack">←</text>
        <text class="header-title">我的邀请</text>
      </view>
    </view>

    <view class="stats-card">
      <view class="stat-item">
        <text class="stat-value invitees">{{ data.inviteeCount }}</text>
        <text class="stat-label">邀请人数</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value points">{{ data.totalPoints }}</text>
        <text class="stat-label">累计积分</text>
      </view>
    </view>

    <view class="guide-card">
      <view class="guide-title">如何获得积分？</view>
      <view class="guide-step">1. 分享活动给好友</view>
      <view class="guide-step">2. 好友通过你的邀请报名成功</view>
      <view class="guide-step">3. 积分自动到账，邀请越多积分越多</view>
    </view>

    <view v-if="data.activities.length" class="section">
      <view class="section-title">按活动统计</view>
      <view v-for="a in data.activities" :key="a.activity" class="activity-item">
        <view class="activity-info">
          <text class="activity-name">{{ a.activity }}</text>
          <text class="activity-count">邀请 {{ a.inviteeCount }} 人</text>
        </view>
        <text class="activity-points">+{{ a.totalPoints }}</text>
      </view>
    </view>

    <view v-if="data.details.length" class="section">
      <view class="section-title">发放明细</view>
      <view v-for="(d, i) in data.details" :key="i" class="detail-item">
        <view class="detail-info">
          <text class="detail-activity">{{ d.activity }}</text>
          <text class="detail-time">{{ formatTime(d.issuedAt) }}</text>
        </view>
        <text class="detail-points">+{{ d.points }}</text>
      </view>
    </view>

    <view v-if="!loading && data.inviteeCount === 0" class="empty-state">
      <text class="empty-icon">🎉</text>
      <text class="empty-text">还没有邀请记录</text>
      <text class="empty-sub">去分享活动给好友，报名成功后积分自动到账</text>
    </view>

    <view v-if="loading" class="loading"><text>加载中...</text></view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { myInvitation } from '../../services/api'
import { validateLogin } from '../../utils/auth'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

const siteConfig = getStoredAuthConfig()
const loading = ref(true)
const data = ref<{ inviteeCount: number; totalPoints: number; activities: any[]; details: any[] }>({
  inviteeCount: 0,
  totalPoints: 0,
  activities: [],
  details: [],
})

async function load() {
  if (!validateLogin()) return
  loading.value = true
  try {
    const res = await myInvitation()
    data.value = {
      inviteeCount: (res as any)?.inviteeCount ?? 0,
      totalPoints: (res as any)?.totalPoints ?? 0,
      activities: (res as any)?.activities ?? [],
      details: (res as any)?.details ?? [],
    }
  } catch (e) {
    console.error('[my-invitation] load failed:', e)
  } finally {
    loading.value = false
  }
}

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
}

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/profile' })
  }
}

onShow(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '我的邀请' })
  // #endif
  load()
  setupPageShare({ title: '我的邀请' })
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
  background: linear-gradient(135deg, #ff9a9e 0%, #fad0c4 45%, #fbc2eb 100%);
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
  font-size: 44rpx;
  font-weight: bold;

  &.invitees { color: #ff6b6b; }
  &.points { color: #f59e0b; }
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

.guide-card {
  margin: 0 30rpx 20rpx;
  background: #fff7e6;
  border-radius: 20rpx;
  padding: 25rpx 30rpx;
  border: 1rpx solid #ffe7ba;
}

.guide-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #d48806;
  margin-bottom: 12rpx;
}

.guide-step {
  font-size: 26rpx;
  color: #fa8c16;
  line-height: 1.8;
}

.section {
  margin: 0 30rpx 20rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 15rpx;
}

.activity-item,
.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  padding: 25rpx;
  border-radius: 16rpx;
  margin-bottom: 15rpx;
}

.activity-info,
.detail-info {
  flex: 1;
  padding-right: 20rpx;
}

.activity-name,
.detail-activity {
  display: block;
  font-size: 28rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-count,
.detail-time {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 5rpx;
}

.activity-points,
.detail-points {
  font-size: 30rpx;
  font-weight: bold;
  color: #f59e0b;
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
  font-size: 30rpx;
  color: #666;
  margin-top: 20rpx;
}

.empty-sub {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-top: 10rpx;
}

.loading {
  text-align: center;
  padding: 40rpx;
  font-size: 26rpx;
  color: #999;
}
</style>