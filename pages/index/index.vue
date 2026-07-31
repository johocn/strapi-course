<template>
  <view class="page-container">
    <!-- 顶部背景区域 -->
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <!-- 首登欢迎提示（由 auth-callback 写入 isNewUser=1 触发，点击或 5 秒后自动消失） -->
        <view v-if="showWelcome" class="welcome-banner" @click="dismissWelcome">
          <text class="welcome-icon">🎉</text>
          <text class="welcome-text">欢迎加入{{ siteConfig?.siteName ?? '圣麟教育' }}，开启学习之旅！</text>
          <text class="welcome-close">×</text>
        </view>
        <view class="header-top">
          <view class="header-left">
            <text class="header-title">🎓 全部课程</text>
            <text class="header-subtitle">学习课程，答题赢积分</text>
          </view>
          <view class="header-right">
            <view v-if="isLoggedIn" class="user-info" @click="goToProfile">
              <view class="user-avatar">
                <text>{{ (user?.name || user?.username || user?.nickname)?.slice(0, 1) || '用' }}</text>
              </view>
              <text class="user-name">{{ user?.name || user?.username || user?.nickname || '用户' }}</text>
            </view>
            <view v-else class="login-btn" @click="goToLogin">
              <text>登录</text>
            </view>
          </view>
        </view>
        
        <!-- 积分展示 -->
        <view v-if="isLoggedIn" class="points-banner">
          <view class="points-left">
            <text class="points-icon">💰</text>
            <text class="points-label">我的积分</text>
          </view>
          <view class="points-right">
            <text class="points-value">{{ pointBalance }}</text>
            <text class="points-unit">积分</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input 
        class="search-input" 
        placeholder="搜索课程名称" 
        v-model="searchKeyword"
        @confirm="handleSearch"
      />
      <view class="search-btn" @click="handleSearch">
        <text>搜索</text>
      </view>
    </view>

    <!-- 分类标签 -->
    <view class="category-tabs">
      <scroll-view scroll-x class="tabs-scroll">
        <view 
          v-for="cat in categories" 
          :key="cat.id"
          :class="['tab-item', { active: activeCategory === cat.id }]"
          @click="handleCategoryChange(cat.id)"
        >
          <text>{{ cat.name }}</text>
        </view>
      </scroll-view>
    </view>

    <!-- 课程列表 -->
    <view class="course-list">
      <view 
        v-for="course in courseList" 
        :key="course.documentId" 
        class="course-card"
        @click="goToCourseDetail(course.documentId)"
      >
        <!-- 课程封面 -->
        <view class="course-cover">
          <image 
            v-if="course.cover?.url" 
            :src="getImageUrl(course.cover.url)" 
            mode="aspectFill" 
            class="cover-image"
          />
          <view v-else class="cover-placeholder">📚</view>
          
          <!-- 付费/免费标签 -->
          <view class="course-badge">
            <text v-if="course.isPaid && !course.isFree" class="badge-paid">付费</text>
            <text v-else-if="course.isFree" class="badge-free">免费</text>
          </view>
          
          <!-- 积分标签 -->
          <view v-if="course.enablePoints && course.points > 0" class="points-badge">
            <text>+{{ course.points }}积分</text>
          </view>
        </view>
        
        <!-- 课程信息 -->
        <view class="course-info">
          <text class="course-title">{{ course.title }}</text>
          <text class="course-desc">{{ course.description || '暂无课程描述' }}</text>
          
          <!-- 课程元信息 -->
          <view class="course-meta">
            <view class="meta-left">
              <text class="meta-item">📖 {{ course.category?.name || '综合' }}</text>
              <text class="meta-item" v-if="course.difficulty">🎯 {{ getDifficultyText(course.difficulty) }}</text>
            </view>
            <text class="meta-item" v-if="course.studentCount">👥 {{ course.studentCount }}人学习</text>
          </view>
          
          <!-- 操作按钮 -->
          <view class="course-action">
            <text class="action-btn">
              {{ course.isPaid && !course.isFree ? '立即购买' : '开始学习' }}
            </text>
          </view>
        </view>
      </view>
      
      <!-- 空状态 -->
      <view v-if="!loading && courseList.length === 0" class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-text">暂无课程</text>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getCourseList, getPointBalance, getCourseCategories, getInviteStats } from '../../services/api'
import { validateLogin, getAuthUser, checkLogin } from '../../utils/auth'
import { getImageUrl } from '../../utils/env'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import type { Course } from '../../services/api'

// #ifdef H5
import { isWechatBrowser } from '../../utils/env'
// H5 微信环境:用 setupPageShare 配置分享(小程序的 onShareAppMessage 在 H5 不生效)
if (typeof window !== 'undefined' && isWechatBrowser()) {
  setupPageShare()
}
// #endif

const searchKeyword = ref('')
const activeCategory = ref('all')
const courseList = ref<Course[]>([])
const loading = ref(false)
const user = ref<any>(null)
const pointBalance = ref(0)
const isLoggedIn = ref(false)
const inviteCode = ref('')
const siteConfig = ref<any>(null)
// 首登欢迎提示（auth-callback 写入 isNewUser=1 时触发）
const showWelcome = ref(false)
let welcomeTimer: any = null

function dismissWelcome() {
  showWelcome.value = false
  uni.removeStorageSync('isNewUser')
  if (welcomeTimer) {
    clearTimeout(welcomeTimer)
    welcomeTimer = null
  }
}

function checkNewUserWelcome() {
  if (uni.getStorageSync('isNewUser') === '1') {
    showWelcome.value = true
    // 5 秒后自动消失
    welcomeTimer = setTimeout(() => {
      dismissWelcome()
    }, 5000)
  }
}

function getUserInfo() {
  const loginState = checkLogin()
  isLoggedIn.value = loginState.isLoggedIn
  user.value = loginState.user || getAuthUser()
}

// 获取邀请码
async function loadInviteCode() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getInviteStats()
    inviteCode.value = res?.data?.inviteCode || ''
  } catch (e) {
    console.error('获取邀请码失败', e)
  }
}

// 获取积分余额
async function loadPointBalance() {
  if (!isLoggedIn.value) return
  try {
    const res: any = await getPointBalance()
    // getPointBalance 已返回 res?.data，所以直接用 res?.balance
    pointBalance.value = res?.balance ?? res?.globalBalance ?? 0
  } catch (e) {
    console.error('获取积分失败', e)
  }
}

function goToProfile() {
  uni.switchTab({ url: '/pages/profile/profile' })
}

// 分类列表
const categories = ref<Array<{ id: string; name: string }>>([
  { id: 'all', name: '全部' }
])

// 加载分类列表
async function loadCategories() {
  try {
    const res: any = await getCourseCategories()
    const categoryList = res?.data || []
    
    // 转换格式并添加"全部"选项
    const formattedCategories = categoryList.map((cat: any) => ({
      id: cat.documentId || cat.id,
      name: cat.name || '未命名分类'
    }))
    
    categories.value = [{ id: 'all', name: '全部' }, ...formattedCategories]
  } catch (e) {
    console.error('加载分类失败', e)
    // 使用默认分类
    categories.value = [
      { id: 'all', name: '全部' },
      { id: 'tech', name: '技术' },
      { id: 'language', name: '语言' },
      { id: 'art', name: '艺术' },
      { id: 'business', name: '商业' }
    ]
  }
}

// 获取难度文本
function getDifficultyText(difficulty: string): string {
  const map: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高级',
    expert: '专家'
  }
  return map[difficulty] || difficulty
}

// 加载课程列表
async function loadCourses() {
  loading.value = true
  try {
    const params: any = {}
    
    if (activeCategory.value !== 'all') {
      params.category = activeCategory.value
    }
    
    if (searchKeyword.value) {
      params.q = searchKeyword.value
    }
    
    const res: any = await getCourseList(params)
    courseList.value = res?.data || []
  } catch (e) {
    console.error('加载课程失败', e)
    courseList.value = [
      { documentId: '1', title: '英语口语入门', description: '从零开始学英语，轻松开口说', status: 'published', createdAt: '2024-01-01', category: { name: '语言' } },
      { documentId: '2', title: 'Python编程基础', description: '零基础学编程，开启编程之旅', status: 'published', createdAt: '2024-01-02', category: { name: '技术' } },
      { documentId: '3', title: '绘画技巧分享', description: '掌握绘画技巧，画出美丽作品', status: 'published', createdAt: '2024-01-03', category: { name: '艺术' } },
      { documentId: '4', title: '数据分析实战', description: '数据驱动决策，提升职场竞争力', status: 'published', createdAt: '2024-01-04', category: { name: '商业' } }
    ]
  }
  loading.value = false
}

// 处理分类切换
function handleCategoryChange(categoryId: string) {
  activeCategory.value = categoryId
  loadCourses()
}

// 处理搜索
function handleSearch() {
  loadCourses()
}

// 跳转到课程详情
function goToCourseDetail(id: string) {
  const isGuest = uni.getStorageSync('isGuest')
  if (isGuest === 'true') {
    uni.showModal({
      title: '游客模式',
      content: '游客模式下无法学习课程，请登录后继续。',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          uni.removeStorageSync('isGuest')
          uni.navigateTo({ url: '/pages/login/login' })
        }
      }
    })
    return
  }
  
  if (!validateLogin()) {
    uni.navigateTo({ url: '/pages/login/login' })
    return
  }
  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${id}` })
}

// 跳转到登录页
function goToLogin() {
  uni.removeStorageSync('isGuest')
  uni.navigateTo({ url: '/pages/login/login' })
}

// 处理邀请码参数
function handleInviteCode() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  if (options.inviteCode) {
    uni.setStorageSync('inviteCode', options.inviteCode)
    console.log('邀请码已保存:', options.inviteCode)
  }
}

onMounted(() => {
  handleInviteCode()
  refreshData()
  // 检查首登欢迎提示（auth-callback 写入的 isNewUser 标记）
  checkNewUserWelcome()
})

onShow(() => {
  // 每次页面显示时刷新数据（如登录后返回首页）
  refreshData()
  // H5 微信环境：刷新分享配置（用租户配置兜底 + 登录用户附加邀请码）
  // #ifdef H5
  setupPageShare()
  // #endif
})

function refreshData() {
  getUserInfo()
  loadCategories()
  loadCourses()
  loadPointBalance()
  loadInviteCode()
}

// 微信分享（携带邀请码）
onShareAppMessage(() => {
  const authConfig = getStoredAuthConfig()
  const sharePath = inviteCode.value 
    ? `/pages/index/index?inviteCode=${inviteCode.value}` 
    : authConfig?.sharePath ?? '/pages/index/index'
  return {
    title: authConfig?.shareTitle ?? '圣麟教育 - 学习课程，答题赢积分',
    path: sharePath,
    imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
  }
})

onShareTimeline(() => {
  const authConfig = getStoredAuthConfig()
  const shareQuery = inviteCode.value 
    ? `inviteCode=${inviteCode.value}` 
    : ''
  return {
    title: authConfig?.shareTitle ?? '圣麟教育 - 学习课程，答题赢积分！快来一起学习吧！',
    query: shareQuery,
    imageUrl: authConfig?.shareImage ?? '/static/share-image.png'
  }
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
  padding: 40rpx 30rpx;
  overflow: hidden;
}

.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 260rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
}

/* 首登欢迎提示 */
.welcome-banner {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 16rpx;
  background: linear-gradient(135deg, #fff8e1 0%, #ffe082 100%);
  border-radius: 12rpx;
  border: 1rpx solid #ffb300;
  box-shadow: 0 4rpx 12rpx rgba(255, 179, 0, 0.2);
  cursor: pointer;
}

.welcome-icon {
  font-size: 32rpx;
  flex-shrink: 0;
}

.welcome-text {
  flex: 1;
  font-size: 26rpx;
  color: #5d4037;
  font-weight: 500;
}

.welcome-close {
  font-size: 36rpx;
  color: #6d4c41;
  flex-shrink: 0;
  line-height: 1;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-left {
  flex: 1;
}

.header-right {
  flex-shrink: 0;
}

.login-btn {
  padding: 12rpx 30rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 30rpx;
}

.login-btn text {
  font-size: 26rpx;
  color: #fff;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15rpx;
  padding: 8rpx 20rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 40rpx;
}

.user-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar text {
  font-size: 26rpx;
  color: #fff;
  font-weight: bold;
}

.user-name {
  font-size: 26rpx;
  color: #fff;
}

.header-title {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
}

.header-subtitle {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 10rpx;
}

// 积分展示区
.points-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 30rpx;
  padding: 20rpx 25rpx;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 15rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.points-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.points-icon {
  font-size: 36rpx;
}

.points-label {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

.points-right {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.points-value {
  font-size: 44rpx;
  font-weight: bold;
  color: #ffd700;
}

.points-unit {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}

.search-bar {
  display: flex;
  margin: -30rpx 30rpx 20rpx;
  background: #fff;
  border-radius: 40rpx;
  padding: 0 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
}

.search-input {
  flex: 1;
  height: 80rpx;
  font-size: 28rpx;
}

.search-btn {
  padding: 0 30rpx;
  line-height: 80rpx;
  color: #667eea;
  font-size: 28rpx;
}

.category-tabs {
  padding: 0 30rpx;
  margin-bottom: 20rpx;
}

.tabs-scroll {
  white-space: nowrap;
}

.tab-item {
  display: inline-block;
  padding: 15rpx 30rpx;
  margin-right: 20rpx;
  background: #fff;
  border-radius: 30rpx;
  font-size: 28rpx;
  color: #666;
  
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.course-list {
  padding: 0 30rpx;
}

.course-card {
  display: flex;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.course-cover {
  width: 220rpx;
  height: 180rpx;
  background: #f5f5f5;
  flex-shrink: 0;
  position: relative;
}

.cover-image {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 70rpx;
  background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
}

.course-badge {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
}

.badge-paid, .badge-free {
  display: inline-block;
  padding: 4rpx 12rpx;
  font-size: 20rpx;
  border-radius: 8rpx;
}

.badge-paid {
  background: #ff6b6b;
  color: #fff;
}

.badge-free {
  background: #51cf66;
  color: #fff;
}

.points-badge {
  position: absolute;
  bottom: 10rpx;
  right: 10rpx;
  background: linear-gradient(135deg, #ffd700 0%, #ffb700 100%);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  
  text {
    font-size: 20rpx;
    color: #333;
    font-weight: bold;
  }
}

.course-info {
  flex: 1;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.course-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  line-height: 1.4;
}

.course-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.course-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
  flex-wrap: wrap;
  gap: 10rpx;
}

.meta-left {
  display: flex;
  gap: 15rpx;
}

.meta-item {
  font-size: 22rpx;
  color: #666;
}

.course-action {
  margin-top: 15rpx;
}

.action-btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 12rpx 30rpx;
  border-radius: 25rpx;
  font-size: 26rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.loading {
  text-align: center;
  padding: 40rpx;
  color: #999;
}
</style>
