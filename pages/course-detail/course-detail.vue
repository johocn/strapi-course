<template>
  <view class="page-container">
    <view class="header">
      <view class="header-bg"></view>
      <view class="header-content">
        <view class="back-btn" @click="goBack">
          <text>←</text>
        </view>
        <text class="header-title">课程详情</text>
        <view class="header-right" @click="showSharePoster = true">
          <text class="share-icon">📤</text>
        </view>
      </view>
    </view>

    <view v-if="course" class="course-detail">
      <view class="course-cover">
        <image v-if="course.coverUrl" :src="course.coverUrl" mode="aspectFill" />
        <view v-else class="cover-placeholder">📚</view>
      </view>

      <view class="course-info">
        <text class="course-title">{{ course.title }}</text>
        <text class="course-desc">{{ course.description }}</text>
        <view class="course-meta">
          <text class="meta-item">分类: {{ course.category?.name || '综合' }}</text>
        </view>
      </view>

      <view class="section">
        <view class="section-header">
          <text class="section-title">课程目录</text>
          <text class="section-count">{{ lessons.length }}课时</text>
        </view>
        <view class="lesson-list">
          <view 
            v-for="(lesson, idx) in lessons" 
            :key="lesson.documentId" 
            :class="['lesson-item', { active: currentLessonIndex === idx, completed: lesson.completed }]"
            @click="startLearning(idx)"
          >
            <view class="lesson-index">{{ idx + 1 }}</view>
            <view class="lesson-content">
              <text class="lesson-title">{{ lesson.title }}</text>
              <text class="lesson-duration">⏱️ {{ formatDuration(lesson.progressDuration ?? lesson.duration ?? 0) }}<text v-if="earnedLessonIds.has(lesson.documentId)" class="earned-tag">积分已领</text></text>
              <view v-if="lesson.progressPercent > 0" class="lesson-progress">
                <view class="progress-bar">
                  <view class="progress-fill" :style="{ width: lesson.progressPercent + '%' }"></view>
                </view>
                <text class="progress-text">{{ lesson.progressPercent }}%</text>
              </view>
            </view>
            <view class="lesson-status">
              <text v-if="lesson.completed" class="status-icon completed">✓</text>
              <text v-else class="status-icon">▶</text>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-bar">
        <view class="course-stats">
          <text class="stat-item">共 {{ lessons.length }}课时</text>
          <text class="stat-item">完成 {{ completedLessons }}课时</text>
          <text v-if="hasEarnedPoints" class="stat-item earned-stat">课程积分已领</text>
        </view>
        <view class="start-btn" @click="startLearning(0)">
          <text>{{ hasStarted ? '继续学习' : '开始学习' }}</text>
        </view>
      </view>
    </view>

    <view v-if="error" class="error-state">
      <text>加载失败</text>
      <button @click="loadData">重试</button>
    </view>
    <view v-else-if="!course" class="loading">
      <text>加载中...</text>
    </view>

    <share-poster 
      :visible="showSharePoster" 
      @close="showSharePoster = false"
      :config="{
        title: course?.title,
        desc: course?.description,
        coverUrl: course?.coverUrl,
        pagePath: `pages/course-detail/course-detail?id=${course?.documentId}`
      }"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCourseDetail, getLessonList, getMyLessonProgresses, getPointRecordList } from '../../services/api'
import type { Course, Lesson } from '../../services/api'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import SharePoster from '../../components/share-poster/share-poster.vue'

const course = ref<Course | null>(null)
const error = ref(false)
const showSharePoster = ref(false)
const siteConfig = getStoredAuthConfig()
const lessons = ref<(Lesson & { completed?: boolean; progressPercent?: number; progressId?: number; playPosition?: number; progressDuration?: number })[]>([])
const currentLessonIndex = ref(0)
const earnedCourseIds = ref<Set<string>>(new Set())
const earnedLessonIds = ref<Set<string>>(new Set())

const hasEarnedPoints = computed(() => {
  // 所有课时都已领积分才显示课程"积分已领"
  if (lessons.value.length === 0) return false
  return lessons.value.every(l => earnedLessonIds.value.has(l.documentId))
})

const hasStarted = computed(() => lessons.value.some(l => l.completed))
const completedLessons = computed(() => lessons.value.filter(l => l.completed).length)

async function loadData() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options ?? {}
  const courseId = options.courseId
  if (!courseId) {
    uni.showToast({ title: '课程ID缺失', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }

  try {
    const [courseRes, lessonsRes, progressRes] = await Promise.all([
      getCourseDetail(courseId),
      getLessonList(courseId),
      getMyLessonProgresses(courseId),
    ])
    // 后端 findOne 返回 { data, meta }，getCourseDetail 已提取 data
    course.value = courseRes ?? null
    const lessonData = (lessonsRes as any)?.data ?? []
    const progressData = (progressRes as any)?.data ?? []

    // 用 documentId 匹配，避免 number/string 类型不一致导致 Map.get 失败
    const progressMap = new Map<string, any>()
    for (const p of progressData) {
      const lessonDocId = p.lesson?.documentId
      if (lessonDocId) progressMap.set(lessonDocId, p)
    }

    lessons.value = lessonData.map((l: any) => {
      const progress = progressMap.get(l.documentId)
      return {
        ...l,
        completed: progress?.isCompleted ?? false,
        progressPercent: Math.min(100, progress?.progress ?? 0),
        progressId: progress?.id ?? undefined,
        playPosition: progress?.playPosition ?? 0,
        progressDuration: progress?.duration ?? 0,
      }
    })

    // 加载已领积分的课时
    try {
      const recordRes = await getPointRecordList({ action: 'quiz_pass', pageSize: 200 })
      const records = (recordRes as any)?.data?.records ?? []
      const lids = new Set<string>()
      for (const r of records) {
        if (r.source) lids.add(String(r.source))
      }
      earnedLessonIds.value = lids
    } catch (e) { console.error('[course-detail] loadPointsRecord failed:', e) }

    // 配置微信分享（课程标题、简介、封面）
    // #ifdef H5
    if (course.value) {
      setupPageShare({
        title: course.value.title,
        desc: course.value.description,
        imgUrl: course.value.coverUrl,
      })
    }
    // #endif
  } catch (e) {
    console.error('加载失败', e)
    error.value = true
  }
}

function startLearning(index: number) {
  const lesson = lessons.value[index]
  uni.setStorageSync('currentLessonId', lesson.documentId)
  uni.setStorageSync('currentCourseId', course.value?.documentId)
  if (lesson.progressId) {
    uni.setStorageSync('currentProgressId', String(lesson.progressId))
  }
  uni.navigateTo({
    url: `/pages/video-player/video-player?courseId=${course.value?.documentId}&lessonIndex=${index}`
  })
}

function goBack() {
  uni.navigateBack()
}

function formatDuration(val: any) {
  const totalSeconds = Number(val) || 0
  if (totalSeconds <= 0) return ''
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (mins > 0) parts.push(`${mins}分钟`)
  if (secs > 0) parts.push(`${secs}秒`)
  return parts.join('') ?? '0秒'
}

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '课程详情' })
  // #endif
  loadData()
})

onShow(() => {
  // H5 微信环境：每次页面显示刷新分享配置
  // #ifdef H5
  if (course.value) {
    setupPageShare({
      title: course.value.title,
      desc: course.value.description,
      imgUrl: course.value.coverUrl,
    })
  }
  // #endif
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
  height: 160rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.back-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  font-size: 32rpx;
  color: #fff;
}

.header-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}

.header-right {
  width: 60rpx;
}

.course-detail {
  margin-top: 20rpx;
}

.course-cover {
  width: 100%;
  height: 400rpx;
  background: #fff;
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
  font-size: 100rpx;
  background: #f0f0f0;
}

.course-info {
  background: #fff;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.course-title {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.course-desc {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-top: 15rpx;
  line-height: 1.6;
}

.course-meta {
  margin-top: 20rpx;
  display: flex;
  gap: 20rpx;
}

.meta-item {
  font-size: 24rpx;
  color: #999;
  background: #f5f5f5;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

.section {
  background: #fff;
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.section-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}

.section-count {
  font-size: 24rpx;
  color: #999;
}

.lesson-list {
  padding: 10rpx 0;
}

.lesson-item {
  display: flex;
  align-items: center;
  padding: 25rpx 30rpx;
  gap: 20rpx;
  transition: background 0.3s;

  &:active {
    background: #f5f5f5;
  }

  &.active {
    background: #f0f4ff;
  }
}

.lesson-index {
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: bold;
  flex-shrink: 0;
}

.lesson-content {
  flex: 1;
}

.lesson-title {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.lesson-duration {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.earned-tag {
  display: inline-block;
  font-size: 20rpx;
  color: #fff;
  background: linear-gradient(135deg, #f5af19 0%, #f12711 100%);
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  margin-left: 10rpx;
  vertical-align: middle;
}

.lesson-progress {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 10rpx;
}

.progress-bar {
  flex: 1;
  height: 8rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 4rpx;
}

.progress-text {
  font-size: 22rpx;
  color: #667eea;
  flex-shrink: 0;
}

.lesson-status {
  flex-shrink: 0;
}

.status-icon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  color: #666;

  &.completed {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.course-stats {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.stat-item {
  font-size: 24rpx;
  color: #666;
}

.earned-stat {
  color: #f5af19;
  font-weight: bold;
}

.start-btn {
  padding: 20rpx 60rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 40rpx;
}

.start-btn text {
  font-size: 30rpx;
  font-weight: bold;
  color: #fff;
}

.loading {
  padding: 100rpx;
  text-align: center;
}

.loading text {
  font-size: 28rpx;
  color: #999;
}

.error-state {
  padding: 100rpx;
  text-align: center;
}

.error-state text {
  display: block;
  font-size: 28rpx;
  color: #999;
  margin-bottom: 20rpx;
}
</style>
