<template>
  <view class="page-container">
    <!-- 游客状态 -->
    <view v-if="guestMode" class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <view class="avatar guest-avatar">
          <text>游</text>
        </view>
        <view class="user-info">
          <text class="user-name">游客用户</text>
          <text class="user-id">登录后享受完整功能</text>
        </view>
      </view>
    </view>

    <!-- 注册用户状态 -->
    <view v-else class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <view class="avatar">
          <text>{{ userInfo.nickname?.charAt(0) ?? '用' }}</text>
        </view>
        <view class="user-info">
          <text class="user-name">{{ userInfo.nickname ?? '用户' }}</text>
          <text class="user-id">ID: {{ userInfo.id ?? '****' }}</text>
        </view>
      </view>
    </view>

    <!-- 游客模式：登录/注册按钮 -->
    <view v-if="guestMode" class="guest-login-card">
      <view class="guest-login-btn" @click="showLoginModal = true">
        <text class="guest-login-text">登录 / 注册</text>
      </view>
      <text class="guest-login-hint">登录后即可答题赢积分、兑换礼品</text>
    </view>

    <!-- 注册用户：积分卡片 -->
    <view v-else class="points-card">
      <view class="points-info">
        <text class="points-label">我的积分</text>
        <view class="points-amount">
          <text class="points-num">{{ pointsBalance }}</text>
          <text class="points-unit">分</text>
        </view>
      </view>
      <view class="points-action" @click="goToPointsRecord">
        <text>查看明细</text>
        <text class="arrow">→</text>
      </view>
    </view>

    <!-- 签到 & 任务入口（仅注册用户） -->
    <view v-if="!guestMode" class="quick-actions" v-show="featureFlags.signInEnabled || featureFlags.tasksEnabled">
      <view class="action-card sign-in-card" v-if="featureFlags.signInEnabled" @click="goToSignIn">
        <view class="action-icon">📅</view>
        <view class="action-info">
          <text class="action-title">每日签到</text>
          <text class="action-desc" v-if="signInStatus.isSignedInToday">已签到 · 连续{{ signInStatus.streakDays }}天</text>
          <text class="action-desc" v-else>点击签到领积分</text>
        </view>
        <view class="action-arrow">→</view>
      </view>
      <view class="action-card tasks-card" v-if="featureFlags.tasksEnabled" @click="goToTasks">
        <view class="action-icon">📋</view>
        <view class="action-info">
          <text class="action-title">任务中心</text>
          <text class="action-desc">完成任务赚积分</text>
        </view>
        <view class="action-arrow">→</view>
      </view>
    </view>

    <!-- 邀请好友（仅注册用户） -->
    <view v-if="!guestMode" class="invite-card">
      <view class="invite-header">
        <text class="invite-title">🎁 邀请好友</text>
        <text class="invite-desc">邀请好友注册，双方各得50积分</text>
      </view>
      <view class="invite-content">
        <view class="invite-code-wrap">
          <text class="invite-label">我的邀请码</text>
          <view class="invite-code-box">
            <text class="invite-code">{{ inviteCode }}</text>
            <view class="copy-btn" @click="copyInviteCode">
              <text>复制</text>
            </view>
          </view>
        </view>
        <view class="invite-stats">
          <view class="stat-item">
            <text class="stat-value">{{ inviteCount }}</text>
            <text class="stat-label">已邀请</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">{{ invitePoints }}</text>
            <text class="stat-label">获得积分</text>
          </view>
        </view>
      </view>
      <view class="invite-actions">
        <view class="action-btn" @click="shareToFriend">
          <text class="btn-icon">👥</text>
          <text class="btn-text">分享给好友</text>
        </view>
        <view class="action-btn" @click="shareToTimeline">
          <text class="btn-icon">🌐</text>
          <text class="btn-text">分享到朋友圈</text>
        </view>
        <view class="action-btn" @click="showSharePoster = true">
          <text class="btn-icon">🎨</text>
          <text class="btn-text">生成海报</text>
        </view>
      </view>
    </view>

    <share-poster
      :visible="showSharePoster"
      :config="{ templateCode: 'brand_share', pagePath: 'pages/index/index' }"
      @close="showSharePoster = false"
    />

    <view class="menu-section">
      <view class="section-title">学习相关</view>
      <view class="menu-grid">
        <view class="menu-item" @click="goToMyCourses">
          <view class="menu-icon">📚</view>
          <text class="menu-text">我的课程</text>
        </view>
        <view class="menu-item" @click="goToAllCourses">
          <view class="menu-icon">🎓</view>
          <text class="menu-text">全部课程</text>
        </view>
        <view class="menu-item" @click="goToPractice">
          <view class="menu-icon">✏️</view>
          <text class="menu-text">刷题练习</text>
        </view>
        <view class="menu-item" @click="goToExam">
          <view class="menu-icon">📝</view>
          <text class="menu-text">模拟考试</text>
        </view>
        <view class="menu-item" @click="goToWrongQuiz">
          <view class="menu-icon">📌</view>
          <text class="menu-text">错题集</text>
        </view>
        <view class="menu-item" @click="goToExchange">
          <view class="menu-icon">🎁</view>
          <text class="menu-text">积分商城</text>
        </view>
        <view class="menu-item" @click="goToRedeemRecord">
          <view class="menu-icon">📦</view>
          <text class="menu-text">兑换记录</text>
        </view>
        <view class="menu-item" @click="goToActivity">
          <view class="menu-icon">🎪</view>
          <text class="menu-text">线下活动</text>
        </view>
        <view class="menu-item" @click="goToCustomers">
          <view class="menu-icon">👥</view>
          <text class="menu-text">我的客户</text>
        </view>
      </view>
    </view>

    <view class="menu-section">
      <view class="section-title">账户设置</view>
      <view class="menu-list">
        <view class="menu-row" @click="goToGuide">
          <view class="menu-left">
            <text class="row-icon">📖</text>
            <text class="row-text">新手引导</text>
          </view>
          <text class="row-arrow">→</text>
        </view>
        <view class="menu-row" @click="handleSettings">
          <view class="menu-left">
            <text class="row-icon">⚙️</text>
            <text class="row-text">设置</text>
          </view>
          <text class="row-arrow">→</text>
        </view>
        <view class="menu-row" @click="handleAbout">
          <view class="menu-left">
            <text class="row-icon">ℹ️</text>
            <text class="row-text">关于我们</text>
          </view>
          <text class="row-arrow">→</text>
        </view>
        <view v-if="!guestMode" class="menu-row" @click="handleLogout">
          <view class="menu-left">
            <text class="row-icon">🚪</text>
            <text class="row-text">退出登录</text>
          </view>
          <text class="row-arrow">→</text>
        </view>
      </view>
    </view>

    <view v-if="!guestMode" class="daily-info">
      <text class="info-title">📊 今日学习次数</text>
      <view class="progress-ring">
        <view class="ring-bg"></view>
        <view class="ring-fill" :style="{ '--progress': todayProgress }"></view>
        <view class="ring-center">
          <text class="ring-num">{{ todayCount }}</text>
          <text class="ring-label">/ 3次</text>
        </view>
      </view>
      <text class="info-desc">每日答题获得积分上限为3次</text>
    </view>

    <!-- 登录/注册弹窗 -->
    <view v-if="showLoginModal" class="modal-mask" @click.self="showLoginModal = false">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">登录 / 注册</text>
          <view class="modal-close" @click="showLoginModal = false">
            <text>✕</text>
          </view>
        </view>

        <view class="login-tabs">
          <view :class="['tab-item', { active: loginType === 'sms' }]" @click="loginType = 'sms'">
            <text>手机验证码</text>
          </view>
          <view :class="['tab-item', { active: loginType === 'password' }]" @click="loginType = 'password'">
            <text>账号密码</text>
          </view>
        </view>

        <view v-if="loginType === 'sms'">
          <view class="form-item">
            <input class="form-input" v-model="loginForm.phone" type="number" placeholder="请输入手机号" maxlength="11" />
          </view>
          <view class="form-item code-row">
            <input class="form-input code-input" v-model="loginForm.code" type="number" placeholder="请输入验证码" maxlength="6" />
            <view :class="['code-btn', { disabled: counting }]" @click="sendCode">
              <text>{{ counting ? `${countdown}s` : '获取验证码' }}</text>
            </view>
          </view>
        </view>

        <view v-if="loginType === 'password'">
          <view class="form-item">
            <input class="form-input" v-model="loginForm.username" type="text" placeholder="请输入账号或邮箱" />
          </view>
          <view class="form-item">
            <input class="form-input" v-model="loginForm.password" :type="showPassword ? 'text' : 'password'" placeholder="请输入密码" />
          </view>
        </view>

        <view class="agreement">
          <view class="checkbox" @click="agreeTerms = !agreeTerms">
            <view :class="['checkbox-inner', { checked: agreeTerms }]">
              <text v-if="agreeTerms">✓</text>
            </view>
          </view>
          <text class="agreement-text">我已阅读并同意<text class="link" @click.stop="showTerms">《用户协议》</text>和<text class="link" @click.stop="showPrivacy">《隐私政策》</text></text>
        </view>

        <view :class="['modal-login-btn', { disabled: !canLogin }]" @click="handleModalLogin">
          <text>{{ loginType === 'sms' ? '登录 / 注册' : '登录' }}</text>
        </view>

        <view class="modal-tips">
          <text class="tip-text">未注册手机号将自动注册并登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getPointBalance, getInviteStats, getPointFeatureFlags, getSignInStatus, getPointStatistics, login, loginWithPassword } from '../../services/api'
import { getUser, setToken, setUser, setLoginState } from '../../utils/storage'
import { onLogout, validateLogin, isGuest as checkIsGuest } from '../../utils/auth'
import { showShareGuide } from '../../utils/invite'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import SharePoster from '../../components/share-poster/share-poster.vue'

const siteConfig = getStoredAuthConfig()

const guestMode = ref(true)
const showLoginModal = ref(false)
const showSharePoster = ref(false)
const loginType = ref<'sms' | 'password'>('sms')
const showPassword = ref(false)
const agreeTerms = ref(false)
const counting = ref(false)
const countdown = ref(60)
let timer: ReturnType<typeof setInterval> | null = null

const loginForm = ref({
  phone: '',
  code: '',
  username: '',
  password: ''
})

const canLogin = computed(() => {
  if (loginType.value === 'sms') {
    return loginForm.value.phone.length === 11 &&
           loginForm.value.code.length >= 4 &&
           agreeTerms.value
  } else {
    return loginForm.value.username.length > 0 &&
           loginForm.value.password.length >= 6 &&
           agreeTerms.value
  }
})

const pointsBalance = ref(0)
const todayCount = ref(0)
const todayProgress = ref(0)
const userInfo = ref({
  id: '',
  nickname: '',
  avatar: '',
  phone: ''
})
const inviteCode = ref('')
const inviteCount = ref(0)
const invitePoints = ref(0)
const featureFlags = ref({ signInEnabled: false, tasksEnabled: false, redemptionEnabled: true, moduleEnabled: true })
const signInStatus = ref<any>({ isSignedInToday: false, streakDays: 0 })

function updateGuestMode() {
  guestMode.value = !validateLogin()
}

async function loadData() {
  try {
    const flagsRes = await getPointFeatureFlags().catch(() => null)
    if (flagsRes) {
      featureFlags.value = { ...featureFlags.value, ...flagsRes }
    }

    const balanceRes = await getPointBalance()
    pointsBalance.value = (balanceRes as any)?.balance ?? 0

    const user = getUser()
    if (user) {
      userInfo.value = {
        id: String(user.id ?? ''),
        nickname: user.nickname || user.name || user.username || '用户',
        avatar: user.avatar ?? '',
        phone: user.phone ?? ''
      }
    }

    if (featureFlags.value.signInEnabled) {
      const siRes = await getSignInStatus().catch(() => null)
      if (siRes) signInStatus.value = siRes
    }

    const inviteRes = await getInviteStats().catch(() => null)
    if (inviteRes) {
      inviteCode.value = inviteRes.inviteCode ?? ''
      inviteCount.value = inviteRes.stats?.directCount || 0
      invitePoints.value = inviteCount.value * 50
    }

    const statRes = await getPointStatistics().catch(() => null)
    if (statRes) {
      const maxDaily = 3
      todayCount.value = Math.min(Math.floor((statRes as any)?.todayEarned / 100) || 0, maxDaily)
      todayProgress.value = Math.round((todayCount.value / maxDaily) * 100)
    }
  } catch (e) {
    console.error('加载数据失败', e)
  }
}

function sendCode() {
  if (counting.value) return
  if (loginForm.value.phone.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  // 短信服务未配置，明确提示而非伪造发送
  uni.showToast({ title: '短信服务未配置，请联系管理员', icon: 'none' })
}

async function handleModalLogin() {
  if (!canLogin.value) {
    if (!agreeTerms.value) {
      uni.showToast({ title: '请先同意用户协议', icon: 'none' })
    }
    return
  }

  uni.showLoading({ title: '登录中...' })

  try {
    let res: any
    if (loginType.value === 'password') {
      res = await loginWithPassword(loginForm.value.username, loginForm.value.password)
    } else {
      res = await login(loginForm.value.phone, loginForm.value.code)
    }

    const resData = res as any
    if (resData.jwt || resData.token) {
      const token = resData.jwt ?? resData.token

      let displayName = ''
      if (loginType.value === 'password') {
        displayName = resData.user?.name || resData.user?.username || loginForm.value.username
      } else {
        displayName = '用户' + loginForm.value.phone.slice(-4)
      }

      setLoginState({
        token,
        user: resData.user || {
          id: 'user_' + Date.now(),
          name: displayName,
          phone: loginForm.value.phone,
          username: loginForm.value.username
        }
      })

      // 清除游客标记
      uni.removeStorageSync('isGuest')

      uni.hideLoading()
      uni.showToast({ title: '登录成功', icon: 'success' })

      showLoginModal.value = false
      guestMode.value = false
      loadData()
    } else {
      throw new Error('登录失败')
    }
  } catch (e: any) {
    uni.hideLoading()
    const errorMessage = e?.error?.message ?? e?.message ?? '登录失败'
    uni.showToast({ title: errorMessage, icon: 'none' })
  }
}

function copyInviteCode() {
  uni.setClipboardData({
    data: inviteCode.value,
    success: () => {
      uni.showToast({ title: '邀请码已复制', icon: 'success' })
    }
  })
}

function shareToFriend() {
  // #ifdef MP-WEIXIN
  showShareGuide()
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中使用此功能', icon: 'none' })
  // #endif
}

function shareToTimeline() {
  // #ifdef MP-WEIXIN
  showShareGuide()
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序中使用此功能', icon: 'none' })
  // #endif
}

function goToPointsRecord() {
  uni.navigateTo({ url: '/pages/points-record/points-record' })
}

function goToMyCourses() {
  uni.switchTab({ url: '/pages/my-course/my-course' })
}

function goToAllCourses() {
  uni.switchTab({ url: '/pages/index/index' })
}

function goToExchange() {
  uni.switchTab({ url: '/pages/exchange/exchange' })
}

function goToRedeemRecord() {
  uni.navigateTo({ url: '/pages/redeem-record/redeem-record' })
}

function goToActivity() {
  uni.navigateTo({ url: '/pages/activity/list' })
}

function goToCustomers() {
  uni.navigateTo({ url: '/pages/partner/customers' })
}

function goToSignIn() {
  uni.navigateTo({ url: '/pages/sign-in/sign-in' })
}

function goToPractice() {
  uni.navigateTo({ url: '/pages/quiz/practice' })
}

function goToExam() {
  uni.navigateTo({ url: '/pages/quiz/exam/index' })
}

function goToWrongQuiz() {
  uni.navigateTo({ url: '/pages/wrong-quiz/index' })
}

function goToTasks() {
  uni.navigateTo({ url: '/pages/tasks/tasks' })
}

function goToGuide() {
  uni.navigateTo({ url: '/pages/guide/guide' })
}

function handleSettings() {
  uni.showToast({ title: '设置功能开发中', icon: 'none' })
}

function handleAbout() {
  uni.showModal({
    title: '关于我们',
    content: `${siteConfig?.siteName ?? '学习平台'} - ${siteConfig?.siteDescription ?? '让学习更有价值'}`,
    showCancel: false
  })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        onLogout()
      }
    }
  })
}

function showTerms() {
  uni.showModal({ title: '用户协议', content: '这里是用户协议内容...', showCancel: false })
}

function showPrivacy() {
  uni.showModal({ title: '隐私政策', content: '这里是隐私政策内容...', showCancel: false })
}

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '我的' })
  // #endif
  updateGuestMode()
  if (!guestMode.value) {
    loadData()
  }
})

onShow(() => {
  updateGuestMode()
  if (!guestMode.value) {
    loadData()
  }
  // H5 微信环境：配置分享（标题用"个人中心"，其余租户兜底）
  // #ifdef H5
  setupPageShare({ title: '个人中心' })
  // #endif
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.header {
  position: relative;
  padding: 60rpx 30rpx 40rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 280rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50rpx;
  color: #fff;
}

.guest-avatar {
  background: rgba(255, 255, 255, 0.15);
  border: 2rpx dashed rgba(255, 255, 255, 0.5);
}

.user-info {
  margin-left: 30rpx;
}

.user-name {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.user-id {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 5rpx;
}

/* 游客登录卡片 */
.guest-login-card {
  margin: -30rpx 30rpx 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 30rpx;
  text-align: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.guest-login-btn {
  height: 88rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guest-login-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.guest-login-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: #999;
}

.points-card {
  display: flex;
  margin: -30rpx 30rpx 20rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
}

.points-info {
  flex: 1;
}

.points-label {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.points-amount {
  display: flex;
  align-items: baseline;
}

.points-num {
  font-size: 56rpx;
  font-weight: bold;
  color: #667eea;
}

.points-unit {
  font-size: 28rpx;
  color: #999;
  margin-left: 8rpx;
}

.points-action {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: #667eea;
  font-size: 28rpx;
}

.arrow {
  font-size: 28rpx;
}

.quick-actions {
  display: flex;
  gap: 20rpx;
  margin: 20rpx 30rpx;
}

.action-card {
  flex: 1;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.action-icon {
  font-size: 48rpx;
  margin-right: 16rpx;
}

.action-info {
  flex: 1;
}

.action-title {
  display: block;
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
}

.action-desc {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
}

.action-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.invite-card {
  margin: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 30rpx;
  color: #fff;
}

.invite-header {
  margin-bottom: 20rpx;
}

.invite-title {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
}

.invite-desc {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.invite-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.invite-code-wrap {
  flex: 1;
}

.invite-label {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 10rpx;
}

.invite-code-box {
  display: flex;
  align-items: center;
  gap: 15rpx;
}

.invite-code {
  font-size: 36rpx;
  font-weight: bold;
  letter-spacing: 4rpx;
}

.copy-btn {
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20rpx;
  font-size: 24rpx;
}

.invite-stats {
  display: flex;
  gap: 30rpx;
}

.invite-stats .stat-item {
  text-align: center;
}

.invite-stats .stat-value {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
}

.invite-stats .stat-label {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 5rpx;
}

.invite-actions {
  display: flex;
  gap: 20rpx;
}

.invite-actions .action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12rpx;
}

.btn-icon {
  font-size: 32rpx;
}

.btn-text {
  font-size: 28rpx;
}

.menu-section {
  margin: 20rpx 30rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.section-title {
  padding: 20rpx 25rpx;
  font-size: 26rpx;
  color: #999;
  background: #fafafa;
}

.menu-grid {
  display: flex;
  flex-wrap: wrap;
}

.menu-item {
  width: 33.33%;
  padding: 30rpx 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.menu-icon {
  font-size: 50rpx;
  margin-bottom: 10rpx;
}

.menu-text {
  font-size: 24rpx;
  color: #333;
}

.menu-list {
  padding: 10rpx 0;
}

.menu-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25rpx 25rpx;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.menu-left {
  display: flex;
  align-items: center;
}

.row-icon {
  font-size: 36rpx;
  margin-right: 20rpx;
}

.row-text {
  font-size: 30rpx;
  color: #333;
}

.row-arrow {
  font-size: 28rpx;
  color: #ccc;
}

.daily-info {
  margin: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  padding: 30rpx;
  text-align: center;
}

.info-title {
  display: block;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 20rpx;
}

.progress-ring {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto;
}

.ring-bg {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 12rpx solid rgba(255, 255, 255, 0.3);
}

.ring-fill {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 12rpx solid #fff;
  border-color: transparent #fff #fff #fff;
  transform: rotate(calc(var(--progress) * 3.6deg - 90deg));
}

.ring-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100rpx;
  height: 100rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: baseline;
  justify-content: center;
}

.ring-num {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.ring-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.info-desc {
  display: block;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 20rpx;
}

/* 弹窗样式 */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 640rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.modal-close {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  color: #999;
}

.login-tabs {
  display: flex;
  background: #f5f5f5;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 30rpx;
}

.tab-item {
  flex: 1;
  height: 70rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  transition: all 0.3s;
}

.tab-item text {
  font-size: 28rpx;
  color: #666;
}

.tab-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.tab-item.active text {
  color: #fff;
  font-weight: bold;
}

.form-item {
  margin-bottom: 24rpx;
}

.form-input {
  width: 100%;
  height: 88rpx;
  padding: 0 30rpx;
  background: #f5f5f5;
  border-radius: 16rpx;
  font-size: 30rpx;
  color: #333;
  box-sizing: border-box;
}

.code-row {
  display: flex;
  gap: 20rpx;
}

.code-input {
  flex: 1;
}

.code-btn {
  width: 200rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16rpx;
  flex-shrink: 0;
}

.code-btn text {
  font-size: 24rpx;
  color: #fff;
}

.code-btn.disabled {
  background: #ccc;
}

.agreement {
  display: flex;
  align-items: flex-start;
  gap: 15rpx;
  margin: 24rpx 0;
}

.checkbox {
  padding: 5rpx;
}

.checkbox-inner {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ddd;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;

  &.checked {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-color: #667eea;
  }
}

.checkbox-inner text {
  font-size: 22rpx;
  color: #fff;
}

.agreement-text {
  font-size: 24rpx;
  color: #999;
  line-height: 1.5;
  flex: 1;
}

.link {
  color: #667eea;
}

.modal-login-btn {
  width: 100%;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 48rpx;
}

.modal-login-btn text {
  font-size: 32rpx;
  font-weight: bold;
  color: #fff;
}

.modal-login-btn.disabled {
  background: #ccc;
}

.modal-tips {
  text-align: center;
  margin-top: 20rpx;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
}
</style>
