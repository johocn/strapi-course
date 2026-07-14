<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <text class="header-title">我的课程</text>
        <text class="header-subtitle">继续学习，获取积分</text>
      </view>
    </view>

    <view class="stats-card">
      <view class="stat-item">
        <text class="stat-value">{{ courseCount }}</text>
        <text class="stat-label">已学课程</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ totalPoints }}</text>
        <text class="stat-label">累计积分</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-item">
        <text class="stat-value">{{ todayCount }}</text>
        <text class="stat-label">今日次数</text>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">正在学习</text>
      </view>
      <view v-if="learningCourses.length > 0" class="course-list">
        <view
          v-for="course in learningCourses"
          :key="course.documentId"
          class="course-card"
          @click="goToCourse(course.documentId)"
        >
          <view class="course-cover">
            <image
              v-if="course.coverUrl"
              :src="course.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="cover-placeholder">📖</view>
          </view>
          <view class="course-info">
            <text class="course-title">{{ course.title }}</text>
            <text class="course-desc">{{ course.completedLessons }}/{{ course.totalLessons }}课时</text>
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: course.progress + '%' }"></view>
            </view>
            <text class="progress-text">已完成 {{ course.progress }}%</text>
          </view>
          <view class="continue-btn">
            <text>继续</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-icon">📚</text>
        <text class="empty-text">还没有开始学习的课程</text>
        <view class="empty-btn" @click="goToAllCourses">
          <text>去选课</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-header">
        <text class="section-title">已完成课程</text>
      </view>
      <view v-if="completedCourses.length > 0" class="course-list">
        <view
          v-for="course in completedCourses"
          :key="course.documentId"
          class="course-card completed"
          @click="goToCourse(course.documentId)"
        >
          <view class="course-cover">
            <image
              v-if="course.coverUrl"
              :src="course.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="cover-placeholder">✅</view>
          </view>
          <view class="course-info">
            <text class="course-title">{{ course.title }}</text>
            <text class="course-desc">{{ course.completedLessons }}/{{ course.totalLessons }}课时</text>
            <text class="completed-badge">已完成</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-icon">🎯</text>
        <text class="empty-text">还没有完成的课程</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getMyCourseProgresses, getPointBalance, getPointStatistics } from '../../services/api'
import { validateLogin } from '../../utils/auth'

interface CourseItem {
  documentId: string
  title: string
  description: string
  coverUrl: string
  progress: number
  completedLessons: number
  totalLessons: number
  isCompleted: boolean
  lastStudyAt: string
}

const courseCount = ref(0)
const totalPoints = ref(0)
const todayCount = ref(0)
const learningCourses = ref<CourseItem[]>([])
const completedCourses = ref<CourseItem[]>([])

function checkLoginStatus() {
  if (!validateLogin()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/login' }) }, 1500)
    return false
  }
  return true
}

async function loadData() {
  try {
    const [progressRes, balanceRes, statsRes] = await Promise.all([
      getMyCourseProgresses(),
      getPointBalance(),
      getPointStatistics(),
    ])

    // 积分余额
    totalPoints.value = (balanceRes as any)?.balance ?? 0

    // 今日学习次数
    todayCount.value = (statsRes as any)?.todayEarned ?? 0

    // 课程进度
    const progressData = (progressRes as any)?.data || []

    // 按 course.documentId 去重，保留最新一条
    const courseMap = new Map<string, any>()
    for (const p of progressData) {
      const docId = p.course?.documentId
      if (!docId) continue
      const existing = courseMap.get(docId)
      if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
        courseMap.set(docId, p)
      }
    }

    const allCourses: CourseItem[] = []
    for (const [, p] of courseMap) {
      const c = p.course || {}
      allCourses.push({
        documentId: c.documentId,
        title: c.title || '未命名课程',
        description: c.description || '',
        coverUrl: c.coverUrl || '',
        progress: Math.min(100, p.progress || 0),
        completedLessons: p.completedLessons || 0,
        totalLessons: p.totalLessons || 0,
        isCompleted: p.isCompleted || false,
        lastStudyAt: p.lastStudyAt || '',
      })
    }

    // 按 lastStudyAt 降序排列
    allCourses.sort((a, b) => new Date(b.lastStudyAt).getTime() - new Date(a.lastStudyAt).getTime())

    learningCourses.value = allCourses.filter(c => !c.isCompleted)
    completedCourses.value = allCourses.filter(c => c.isCompleted)
    courseCount.value = allCourses.length
  } catch (e) {
    console.error('加载数据失败', e)
  }
}

function goToCourse(courseId: string) {
  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${courseId}` })
}

function goToAllCourses() {
  uni.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  if (checkLoginStatus()) loadData()
})

onShow(() => {
  if (checkLoginStatus()) loadData()
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
  height: 200rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
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
  color: #667eea;
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

.section {
  padding: 20rpx 30rpx;
}

.section-header {
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.course-card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  padding: 20rpx;

  &.completed {
    opacity: 0.8;
  }
}

.course-cover {
  width: 120rpx;
  height: 100rpx;
  background: #f5f5f5;
  flex-shrink: 0;
  border-radius: 8rpx;
  overflow: hidden;
}

.course-cover image {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
}

.course-info {
  flex: 1;
  padding: 0 20rpx;
  display: flex;
  flex-direction: column;
}

.course-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
}

.course-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}

.progress-bar {
  height: 12rpx;
  background: #eee;
  border-radius: 6rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-text {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
}

.completed-badge {
  display: inline-block;
  background: #52c41a;
  color: #fff;
  padding: 5rpx 15rpx;
  border-radius: 10rpx;
  font-size: 22rpx;
  margin-top: 8rpx;
  align-self: flex-start;
}

.continue-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 15rpx 30rpx;
  border-radius: 25rpx;
  font-size: 26rpx;
  white-space: nowrap;
  align-self: center;
}

.empty-state {
  background: #fff;
  border-radius: 16rpx;
  padding: 60rpx 30rpx;
  text-align: center;
}

.empty-icon {
  font-size: 60rpx;
  display: block;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
  display: block;
}

.empty-btn {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 15rpx 40rpx;
  border-radius: 30rpx;
  font-size: 28rpx;
  margin-top: 30rpx;
}
</style>
