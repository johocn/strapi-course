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

    <!-- 三 Tab 切换 -->
    <view class="tabs-bar">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-item', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <text class="tab-text">{{ tab.label }}</text>
        <text v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</text>
      </view>
    </view>

    <!-- 学习中 -->
    <view v-if="activeTab === 'learning'" class="section">
      <view v-if="learningCourses.length > 0" class="course-list">
        <view
          v-for="course in learningCourses"
          :key="course.documentId"
          class="course-card"
          :class="{ completed: course.isCompleted }"
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
            <view class="course-meta-row">
              <text class="progress-text">已完成 {{ course.progress }}%</text>
              <text v-if="course.isCompleted" class="completed-badge">已完成</text>
            </view>
          </view>
          <view class="continue-btn">
            <text>{{ course.isCompleted ? '复习' : '继续' }}</text>
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

    <!-- 待开通 -->
    <view v-if="activeTab === 'pending'" class="section">
      <view v-if="pendingCourses.length > 0" class="course-list">
        <view
          v-for="item in pendingCourses"
          :key="item.documentId"
          class="course-card pending"
          @click="goToCourse(item.courseDocumentId)"
        >
          <view class="course-cover">
            <image
              v-if="item.coverUrl"
              :src="item.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="cover-placeholder">⏳</view>
          </view>
          <view class="course-info">
            <text class="course-title">{{ item.title }}</text>
            <view class="pending-meta">
              <text class="enroll-type-tag">{{ enrollTypeText(item.enrollType) }}</text>
              <text class="pending-status">{{ pendingStatusText(item.status) }}</text>
            </view>
            <text v-if="item.enrollType === 'paid' && item.voucherNote" class="voucher-note">
              备注：{{ item.voucherNote }}
            </text>
            <text v-if="item.status === 'rejected' && item.reviewNote" class="reject-reason">
              驳回原因：{{ item.reviewNote }}
            </text>
            <text class="submit-time">提交于 {{ formatTime(item.createdAt) }}</text>
          </view>
          <view v-if="item.status === 'rejected'" class="continue-btn">
            <text>重新提交</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-icon">⏳</text>
        <text class="empty-text">暂无待开通的课程</text>
        <view class="empty-btn" @click="goToAllCourses">
          <text>去选课</text>
        </view>
      </view>
    </view>

    <!-- 已报名 -->
    <view v-if="activeTab === 'enrolled'" class="section">
      <view v-if="enrolledCourses.length > 0" class="course-list">
        <view
          v-for="item in enrolledCourses"
          :key="item.documentId"
          class="course-card"
          @click="goToCourse(item.courseDocumentId)"
        >
          <view class="course-cover">
            <image
              v-if="item.coverUrl"
              :src="item.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="cover-placeholder">🎓</view>
          </view>
          <view class="course-info">
            <text class="course-title">{{ item.title }}</text>
            <view class="pending-meta">
              <text class="enroll-type-tag">{{ enrollTypeText(item.enrollType) }}</text>
              <text class="enrolled-badge">已开通</text>
            </view>
            <text v-if="item.enrollType === 'points' && item.pointsSpent" class="submit-time">
              消耗 {{ item.pointsSpent }} 积分
            </text>
            <text v-else-if="item.enrollType === 'code'" class="submit-time">
              开通码：{{ item.accessCode }}
            </text>
            <text class="submit-time">开通于 {{ formatTime(item.enrolledAt || item.createdAt) }}</text>
          </view>
          <view class="continue-btn">
            <text>开始学习</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-icon">🎓</text>
        <text class="empty-text">暂无已报名课程</text>
        <view class="empty-btn" @click="goToAllCourses">
          <text>去选课</text>
        </view>
      </view>
    </view>

    <!-- 我的续学推荐 -->
    <view v-if="suggestions.length > 0" class="section suggest-section">
      <view class="suggest-title">
        <text class="suggest-title-text">我的续学推荐</text>
        <text class="suggest-sub">学完进阶，持续成长</text>
      </view>
      <view class="course-list">
        <view
          v-for="item in suggestions"
          :key="item.documentId"
          class="course-card"
          @click="goToCourse(item.documentId)"
        >
          <view class="course-cover">
            <image v-if="item.cover" :src="item.cover.url || item.coverUrl" mode="aspectFill" />
            <view v-else class="cover-placeholder">🚀</view>
          </view>
          <view class="course-info">
            <text class="course-title">{{ item.title }}</text>
            <view class="pending-meta">
              <text v-if="item.sequenceNext" class="suggest-badge">进阶续学</text>
              <text v-if="item.category" class="enroll-type-tag">{{ item.category }}</text>
            </view>
            <text v-if="item.isPaid && item.price > 0" class="submit-time">价格 ¥{{ item.price }}</text>
            <text v-else-if="item.isFree" class="submit-time">免费课程</text>
          </view>
          <view class="continue-btn"><text>去学习</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getMyCourseProgresses,
  getPointBalance,
  getPointStatistics,
  getMyEnrollments,
  getMyCourseSuggestions,
} from '../../services/api'
import type { Enrollment, EnrollType, EnrollmentStatus } from '../../services/api'
import { validateLogin } from '../../utils/auth'
import { setupPageShare } from '../../utils/share'

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

interface PendingOrEnrolledItem {
  documentId: string
  courseDocumentId: string
  title: string
  coverUrl: string
  enrollType: EnrollType
  status: EnrollmentStatus
  voucherUrl?: string
  voucherNote?: string
  accessCode?: string
  pointsSpent?: number
  reviewNote?: string
  createdAt?: string
  enrolledAt?: string
}

const courseCount = ref(0)
const totalPoints = ref(0)
const todayCount = ref(0)
const activeTab = ref<'learning' | 'pending' | 'enrolled'>('learning')

const learningCourses = ref<CourseItem[]>([])
const pendingCourses = ref<PendingOrEnrolledItem[]>([])
const enrolledCourses = ref<PendingOrEnrolledItem[]>([])
// 我的续学推荐
const suggestions = ref<any[]>([])

const tabs = computed(() => [
  { key: 'learning' as const, label: '学习中', count: learningCourses.value.length },
  { key: 'pending' as const, label: '待开通', count: pendingCourses.value.length },
  { key: 'enrolled' as const, label: '已报名', count: enrolledCourses.value.length },
])

function checkLoginStatus() {
  if (!validateLogin()) {
    uni.showToast({ title: '请先登录', icon: 'none', duration: 1500 })
    setTimeout(() => { uni.navigateTo({ url: '/pages/login/login' }) }, 1500)
    return false
  }
  return true
}

/** 报名类型文案 */
function enrollTypeText(type: EnrollType): string {
  switch (type) {
    case 'free': return '免费'
    case 'points': return '积分兑换'
    case 'paid': return '付费'
    case 'code': return '开通码'
    default: return type
  }
}

/** 待开通状态文案 */
function pendingStatusText(status: EnrollmentStatus): string {
  switch (status) {
    case 'pending_review': return '审核中'
    case 'rejected': return '已驳回'
    case 'revoked': return '已撤销'
    default: return status
  }
}

/** 时间格式化（YYYY-MM-DD HH:mm） */
function formatTime(dateStr?: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function loadData() {
  try {
    const [progressRes, balanceRes, statsRes, enrollmentsRes] = await Promise.all([
      getMyCourseProgresses(),
      getPointBalance(),
      getPointStatistics(),
      getMyEnrollments(),
    ])

    // 积分余额
    totalPoints.value = (balanceRes as any)?.balance ?? 0

    // 今日学习次数
    todayCount.value = (statsRes as any)?.todayEarned ?? 0

    // 课程进度（用于"学习中"）
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

    const allLearning: CourseItem[] = []
    const learningCourseIds = new Set<string>()
    for (const [, p] of courseMap) {
      const c = p.course || {}
      const docId = c.documentId
      learningCourseIds.add(docId)
      allLearning.push({
        documentId: docId,
        title: c.title || '未命名课程',
        description: c.description || '',
        coverUrl: c.coverUrl || '',
        progress: Math.min(100, p.progress || 0),
        completedLessons: p.completedLessons || 0,
        totalLessons: p.totalLessons || 0,
        isCompleted: p.isCompleted || false,
        lastStudyAt: p.lastStudyAt || p.updatedAt || '',
      })
    }

    // 按 lastStudyAt 降序排列，已完成的排后面
    allLearning.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1
      return new Date(b.lastStudyAt).getTime() - new Date(a.lastStudyAt).getTime()
    })
    learningCourses.value = allLearning
    courseCount.value = allLearning.length

    // 报名记录（用于"待开通"和"已报名"）
    const enrollments: Enrollment[] = (enrollmentsRes as any) || []
    const pending: PendingOrEnrolledItem[] = []
    const enrolled: PendingOrEnrolledItem[] = []

    for (const e of enrollments) {
      const course = (e as any).course || {}
      const item: PendingOrEnrolledItem = {
        documentId: (e as any).documentId || '',
        courseDocumentId: course.documentId || '',
        title: course.title || '未命名课程',
        coverUrl: course.coverUrl || '',
        enrollType: e.enrollType,
        status: e.status,
        voucherUrl: e.voucherUrl,
        voucherNote: e.voucherNote,
        accessCode: e.accessCode,
        pointsSpent: e.pointsSpent,
        reviewNote: e.reviewNote,
        createdAt: e.createdAt,
        enrolledAt: e.enrolledAt,
      }

      if (e.status === 'pending_review' || e.status === 'rejected' || e.status === 'revoked') {
        pending.push(item)
      } else if (e.status === 'enrolled') {
        // 已报名但还未开始学的（没有 lesson progress）显示在"已报名"
        // 已开始学的课程已经显示在"学习中"，这里避免重复
        if (!learningCourseIds.has(item.courseDocumentId)) {
          enrolled.push(item)
        }
      }
    }

    pendingCourses.value = pending
    enrolledCourses.value = enrolled
  } catch (e) {
    console.error('加载数据失败', e)
  }

  // 我的续学推荐（独立请求，失败不阻断主列表）
  try {
    const sugRes = await getMyCourseSuggestions()
    suggestions.value = (sugRes as any)?.data || (sugRes as any) || []
  } catch (e) { suggestions.value = [] }
}

function goToCourse(courseId: string) {
  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${courseId}` })
}

function goToAllCourses() {
  uni.switchTab({ url: '/pages/index/index' })
}

onMounted(() => {
  if (checkLoginStatus()) loadData()
  setupPageShare({ title: '我的课程' })
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
  position: relative;
  z-index: 2;
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

.tabs-bar {
  display: flex;
  background: #fff;
  margin: 0 30rpx 20rpx;
  border-radius: 16rpx;
  padding: 8rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.05);
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  border-radius: 12rpx;
  position: relative;
  transition: all 0.2s;

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .tab-text {
      color: #fff;
      font-weight: bold;
    }

    .tab-badge {
      background: rgba(255, 255, 255, 0.3);
      color: #fff;
    }
  }
}

.tab-text {
  font-size: 28rpx;
  color: #666;
}

.tab-badge {
  display: inline-block;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  background: #eee;
  color: #666;
  font-size: 22rpx;
  border-radius: 16rpx;
  margin-left: 6rpx;
}

.section {
  padding: 0 30rpx;
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
    opacity: 0.85;
  }

  &.pending {
    border-left: 6rpx solid #ff9800;
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
  min-width: 0;
}

.course-title {
  font-size: 30rpx;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.course-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6rpx;
}

.progress-text {
  font-size: 22rpx;
  color: #999;
}

.completed-badge {
  display: inline-block;
  background: #52c41a;
  color: #fff;
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
  font-size: 20rpx;
}

.pending-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}

.enroll-type-tag {
  display: inline-block;
  background: #f0f2ff;
  color: #667eea;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.pending-status {
  display: inline-block;
  background: #fff4e6;
  color: #ff9800;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.enrolled-badge {
  display: inline-block;
  background: #e6f7ec;
  color: #52c41a;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.voucher-note {
  font-size: 22rpx;
  color: #666;
  margin-top: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reject-reason {
  font-size: 22rpx;
  color: #f5222d;
  margin-top: 4rpx;
}

.submit-time {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
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

/* 我的续学推荐 */
.suggest-section {
  margin-top: 20rpx;
}
.suggest-title {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  padding: 10rpx 0 20rpx;
}
.suggest-title-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}
.suggest-sub {
  font-size: 22rpx;
  color: #999;
}
.suggest-badge {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}
</style>
