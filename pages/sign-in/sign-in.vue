<template>
  <view class="page-container">
    <!-- 签到状态卡片 -->
    <view class="sign-card">
      <view class="sign-header">
        <text class="sign-title">每日签到</text>
        <view class="streak-info" v-if="signInStatus.streakDays > 0">
          <text class="streak-num">{{ signInStatus.streakDays }}</text>
          <text class="streak-label">天连续签到</text>
        </view>
      </view>

      <view class="sign-btn-wrap">
        <view
          class="sign-btn"
          :class="{ signed: signInStatus.isSignedInToday }"
          @click="handleSignIn"
        >
          <text class="sign-btn-text">{{ signInStatus.isSignedInToday ? '已签到' : '签到' }}</text>
          <text class="sign-btn-sub" v-if="!signInStatus.isSignedInToday">+{{ signInPoints }}积分</text>
        </view>
      </view>

      <!-- 阶梯奖励提示 -->
      <view class="streak-milestones" v-if="milestones.length > 0">
        <text class="milestone-title">连续签到奖励</text>
        <view class="milestone-list">
          <view
            v-for="(m, i) in milestones"
            :key="i"
            class="milestone-item"
            :class="{ reached: signInStatus.streakDays >= m.days }"
          >
            <text class="milestone-days">{{ m.days }}天</text>
            <text class="milestone-points">+{{ m.bonus }}积分</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 签到日历 -->
    <view class="calendar-card">
      <text class="calendar-title">最近签到</text>
      <view class="calendar-grid">
        <view
          v-for="date in recentDates"
          :key="date"
          class="calendar-day signed"
        >{{ date.slice(8) }}</view>
        <view v-if="recentDates.length === 0" class="calendar-empty">
          <text>暂无签到记录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { signIn as apiSignIn, getSignInStatus, getPointRules } from '../../services/api'

const signInStatus = ref<any>({ isSignedInToday: false, streakDays: 0 })
const recentDates = ref<string[]>([])
const signInPoints = ref(5)
const milestones = ref<{ days: number; bonus: number }[]>([])

async function loadStatus() {
  try {
    const res: any = await getSignInStatus()
    signInStatus.value = res || { isSignedInToday: false, streakDays: 0 }
    // 兼容后端返回 recentDates / recentDays / signInDates / dates
    recentDates.value = res?.recentDates || res?.recentDays || res?.signInDates || res?.dates || []
  } catch (e) {
    console.error('获取签到状态失败', e)
  }
}

async function loadMilestones() {
  try {
    const rules = await getPointRules({ action: 'daily_sign_in_streak' })
    const rulesList = Array.isArray(rules) ? rules : (rules?.data || [])
    const streakRule = rulesList.find((r: any) => r.action === 'daily_sign_in_streak')
    if (streakRule) {
      const ec = typeof streakRule.extraConfig === 'string'
        ? JSON.parse(streakRule.extraConfig)
        : streakRule.extraConfig || {}
      if (ec.streakMilestones && ec.streakBonusPoints) {
        milestones.value = ec.streakMilestones.map((d: number, i: number) => ({
          days: d,
          bonus: ec.streakBonusPoints[i] || 0,
        }))
      }
    }
  } catch {
    // 使用默认值
    milestones.value = [
      { days: 7, bonus: 50 },
      { days: 14, bonus: 100 },
      { days: 30, bonus: 200 },
    ]
  }
  // 读取签到固定积分
  try {
    const rules = await getPointRules({ action: 'daily_sign_in' })
    const rulesList = Array.isArray(rules) ? rules : (rules?.data || [])
    const signInRule = rulesList.find((r: any) => r.action === 'daily_sign_in')
    if (signInRule) signInPoints.value = signInRule.points || 5
  } catch {}
}

async function handleSignIn() {
  if (signInStatus.value.isSignedInToday) return
  try {
    const res: any = await apiSignIn()
    const earned = res?.pointsEarned ?? res?.data?.pointsEarned ?? 0
    uni.showToast({ title: `签到成功！+${earned}积分`, icon: 'success' })
    // 强制刷新最近签到
    await loadStatus()
  } catch (e: any) {
    const errMsg = e?.error?.message || e?.error || e?.message || '签到失败'
    uni.showToast({ title: errMsg, icon: 'none' })
  }
}

onMounted(() => {
  loadStatus()
  loadMilestones()
})

onShow(() => {
  loadStatus()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

.sign-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 40rpx;
  color: #fff;
  margin-bottom: 20rpx;
}

.sign-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.sign-title {
  font-size: 36rpx;
  font-weight: bold;
}

.streak-info {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.streak-num {
  font-size: 48rpx;
  font-weight: bold;
}

.streak-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.sign-btn-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 30rpx;
}

.sign-btn {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 4rpx solid rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.sign-btn.signed {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.sign-btn-text {
  font-size: 36rpx;
  font-weight: bold;
}

.sign-btn-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.streak-milestones {
  border-top: 1rpx solid rgba(255, 255, 255, 0.2);
  padding-top: 20rpx;
}

.milestone-title {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 16rpx;
  display: block;
}

.milestone-list {
  display: flex;
  gap: 16rpx;
}

.milestone-item {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
  padding: 16rpx;
  text-align: center;
  border: 2rpx solid transparent;
}

.milestone-item.reached {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
}

.milestone-days {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
}

.milestone-points {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
}

.calendar-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.calendar-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.calendar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.calendar-day {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #999;
}

.calendar-day.signed {
  background: #667eea;
  color: #fff;
}

.calendar-empty {
  width: 100%;
  text-align: center;
  padding: 40rpx;
  color: #999;
  font-size: 28rpx;
}
</style>
