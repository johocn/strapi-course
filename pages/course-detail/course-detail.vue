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
              <text v-else-if="getLessonLockStatus(lesson).locked && getLessonLockStatus(lesson).enforceMode" class="status-icon locked">🔒</text>
              <text v-else-if="getLessonLockStatus(lesson).locked" class="status-icon soft-locked">💡</text>
              <text v-else class="status-icon">▶</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 答题功能入口（开关 && 有内容双重门控） -->
      <view v-if="showEntryRow" class="quiz-entries">
        <view v-if="showPractice" class="quiz-entry" @click="goQuiz('mode=random&course=' + course.documentId)">课程刷题</view>
        <view v-if="showFreeAnswer" class="quiz-entry" @click="goQuiz('mode=free&course=' + course.documentId)">自由答题</view>
        <view v-if="showExam" class="quiz-entry" @click="goExam(course.documentId)">模拟考试</view>
      </view>

      <view class="bottom-bar">
        <view class="course-stats">
          <text class="stat-item">共 {{ lessons.length }}课时</text>
          <text class="stat-item">完成 {{ completedLessons }}课时</text>
          <text v-if="hasEarnedPoints" class="stat-item earned-stat">课程积分已领</text>
        </view>
        <text v-if="enrollStatusText" class="enroll-status-tip">{{ enrollStatusText }}</text>
        <view class="bottom-actions">
          <view
            v-if="!canLearn && displayType === 'paid' && !enrollment"
            class="access-code-link"
            @click="showAccessCodeDialog = true"
          >
            <text>我有开通码</text>
          </view>
          <view
            class="start-btn"
            :class="{ disabled: enrollment?.status === 'pending_review' }"
            @click="handleBottomAction"
          >
            <text>{{ bottomBtnText }}</text>
          </view>
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
        templateCode: 'course_share',
        title: course?.title,
        desc: course?.description,
        coverUrl: course?.coverUrl,
        pagePath: `pages/course-detail/course-detail?id=${course?.documentId}`
      }"
    />

    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockDialogMode"
      :reason="lockDialogReason"
      @goto="handleLockGoto"
      @skip="handleLockSkip"
    />

    <!-- 付费凭证上传弹窗 -->
    <view v-if="showVoucherDialog" class="dialog-mask" @click="showVoucherDialog = false">
      <view class="dialog-content" @click.stop>
        <view class="dialog-title">提交报名凭证</view>
        <view class="dialog-body">
          <view class="voucher-upload" @click="chooseVoucherImage">
            <image v-if="voucherImage" :src="voucherImage" mode="aspectFit" class="voucher-preview" />
            <view v-else class="upload-placeholder">
              <text>+ 上传凭证</text>
            </view>
          </view>
          <textarea
            v-model="voucherNote"
            class="voucher-note-input"
            placeholder="备注（选填，如转账时间、金额等）"
            maxlength="200"
          />
        </view>
        <view class="dialog-actions">
          <view class="dialog-btn cancel" @click="showVoucherDialog = false">取消</view>
          <view class="dialog-btn confirm" @click="submitVoucher">提交</view>
        </view>
      </view>
    </view>

    <!-- 开通码输入弹窗 -->
    <view v-if="showAccessCodeDialog" class="dialog-mask" @click="showAccessCodeDialog = false">
      <view class="dialog-content" @click.stop>
        <view class="dialog-title">输入开通码</view>
        <view class="dialog-body">
          <input
            v-model="accessCodeInput"
            class="access-code-input"
            placeholder="请输入开通码"
            maxlength="20"
          />
        </view>
        <view class="dialog-actions">
          <view class="dialog-btn cancel" @click="showAccessCodeDialog = false">取消</view>
          <view class="dialog-btn confirm" @click="submitAccessCode">确认开通</view>
        </view>
      </view>
    </view>

    <!-- 进阶课程 / 续学推荐 -->
    <view v-if="relatedCourses.length > 0" class="related-section">
      <view class="related-title">
        <text class="related-title-text">进阶课程 / 继续学习</text>
      </view>
      <scroll-view scroll-x class="related-scroll">
        <view
          v-for="item in relatedCourses"
          :key="item.documentId"
          class="related-card"
          @click="goToCourse(item.documentId)"
        >
          <image v-if="item.cover" :src="item.cover.url || item.coverUrl" mode="aspectFill" class="related-cover" />
          <view v-else class="related-cover placeholder">📖</view>
          <text class="related-name">{{ item.title }}</text>
          <view class="related-meta">
            <text v-if="item.sequenceNext" class="related-badge">进阶续学</text>
            <text v-else-if="item.level" class="related-level">{{ item.level }}</text>
            <text v-if="item.isPaid && item.price > 0" class="related-price">¥{{ item.price }}</text>
            <text v-else-if="item.isFree" class="related-price">免费</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCourseDetail, getLessonList, getMyLessonProgresses, getPointRecordList, getMyEnrollment, createEnrollment, getCourseRelated } from '../../services/api'
import type { Enrollment, EnrollType } from '../../services/api'
import type { Course, Lesson } from '../../services/api'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import { checkItemLock } from '../../utils/sequence-lock'
import { parseCourseFeatureFlags, hasGrantedRole } from '../../utils/player-features'
import { getMyRoles } from '../../services/api'
import SharePoster from '../../components/share-poster/share-poster.vue'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'

const course = ref<Course | null>(null)
const myRoles = ref<string[]>([])
const error = ref(false)
const showSharePoster = ref(false)
const siteConfig = getStoredAuthConfig()
const lessons = ref<(Lesson & { completed?: boolean; progressPercent?: number; progressId?: number; playPosition?: number; progressDuration?: number })[]>([])
const currentLessonIndex = ref(0)
const earnedCourseIds = ref<Set<string>>(new Set())
const earnedLessonIds = ref<Set<string>>(new Set())

// 答题功能入口（课程门控 + 角色门控 + 内容门控）
const quizFlags = computed(() => parseCourseFeatureFlags((course.value as any)?.featureFlags).quiz)
const courseQuizCount = computed(
  () => (course.value?.quizzes?.length ?? 0)
    + lessons.value.reduce((n, l) => n + ((l as any)?.quizzes?.length ?? 0), 0)
)
const showPractice = computed(() => !!(quizFlags.value.practice && courseQuizCount.value > 0))
const showFreeAnswer = computed(() => !!(quizFlags.value.freeAnswer && courseQuizCount.value > 0))
const showExam = computed(() =>
  !!(quizFlags.value.exam && (course.value?.exams?.length ?? 0) > 0 && hasGrantedRole(myRoles.value, quizFlags.value.examRoles))
)
const showEntryRow = computed(() => showPractice.value || showFreeAnswer.value || showExam.value)

// 课程续学推荐（进阶/相似课程）
const relatedCourses = ref<any[]>([])

function loadRelated(courseId: string) {
  getCourseRelated(courseId).then((res: any) => {
    relatedCourses.value = (res as any)?.data || (res as any) || []
  }).catch(() => { relatedCourses.value = [] })
}

function goQuiz(query: string) {
  uni.navigateTo({ url: `/pages/quiz/practice?${query}` })
}
function goExam(courseDocumentId: string) {
  uni.navigateTo({ url: `/pages/quiz/exam/index?course=${courseDocumentId}` })
}

// 顺序锁定状态
const lockDialogVisible = ref(false)
const lockDialogMode = ref(false)
const lockDialogReason = ref('')
const lockGotoLessonIndex = ref(-1)  // 前置未完成课时的索引
const lockOriginalLessonIndex = ref(-1)  // 用户原本想打开的课时索引

// 报名状态
const enrollment = ref<Enrollment | null>(null)
const showVoucherDialog = ref(false)
const showAccessCodeDialog = ref(false)
const voucherNote = ref('')
const voucherImage = ref('')
const accessCodeInput = ref('')
const enrolling = ref(false)

/** 课程展示类型（软迁移：courseType 为空时按 isPaid 反推） */
const displayType = computed<'free' | 'points' | 'paid'>(() => {
  const c = course.value as any
  if (!c) return 'free'
  if (c.courseType) return c.courseType
  return c.isPaid ? 'paid' : 'free'
})

/** 是否需要报名才能学习 */
const needEnroll = computed(() => {
  const c = course.value as any
  if (!c) return false
  // 免报名模式或免费课程无需报名
  if (c.enrollMode === 'none') return false
  if (displayType.value === 'free') return false
  return true
})

/** 是否可以学习（已开通或无需报名） */
const canLearn = computed(() => {
  if (!needEnroll.value) return true
  return enrollment.value?.status === 'enrolled'
})

/** 报名状态文案 */
const enrollStatusText = computed(() => {
  if (!enrollment.value) return ''
  switch (enrollment.value.status) {
    case 'pending_review': return '报名审核中'
    case 'rejected': return `报名被驳回：${enrollment.value.reviewNote || '请联系管理员'}`
    case 'revoked': return '学习权限已被撤销'
    default: return ''
  }
})

/** 按钮文案（底部 bar） */
const bottomBtnText = computed(() => {
  if (canLearn.value) {
    return hasStarted.value ? '继续学习' : '开始学习'
  }
  if (enrollment.value?.status === 'pending_review') return '审核中'
  if (enrollment.value?.status === 'rejected') return '重新提交'
  // 未报名
  if (displayType.value === 'points') {
    const price = (course.value as any)?.pointsPrice || 0
    return `积分兑换（${price}积分）`
  }
  if (displayType.value === 'paid') return '提交报名'
  return '立即报名'
})

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
    loadRelated(courseId)
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

    // 加载报名状态（未登录用户静默跳过）
    try {
      enrollment.value = await getMyEnrollment(courseId)
    } catch (e) {
      // 401/403 等未登录场景，enrollment 保持 null
      console.log('[course-detail] enrollment not loaded (maybe not logged in)')
    }

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

/** 获取课时的锁定状态（用于显示锁图标） */
function getLessonLockStatus(lesson: any) {
  if (!lesson.sequenceTag || (lesson.sequenceNumber ?? 0) === 0) {
    return { locked: false, enforceMode: false }
  }
  const allItems = lessons.value
    .filter(l => l.sequenceTag && (l.sequenceNumber ?? 0) > 0)
    .map(l => ({
      documentId: l.documentId,
      title: l.title,
      sequenceNumber: l.sequenceNumber ?? 0,
      sequenceTag: l.sequenceTag,
      enforceSequence: l.enforceSequence ?? course.value?.enforceSequence ?? false,
      isCompleted: l.completed ?? false
    }))
  const result = checkItemLock(
    {
      documentId: lesson.documentId,
      title: lesson.title,
      sequenceNumber: lesson.sequenceNumber ?? 0,
      sequenceTag: lesson.sequenceTag,
      enforceSequence: lesson.enforceSequence ?? course.value?.enforceSequence ?? false,
      isCompleted: lesson.completed ?? false
    },
    allItems
  )
  return result
}

/** 底部按钮点击：根据状态路由到学习或报名 */
function handleBottomAction() {
  if (canLearn.value) {
    startLearning(0)
    return
  }
  if (enrollment.value?.status === 'pending_review') return
  // rejected 状态允许重新提交（走对应 enrollType 流程）
  const type = displayType.value
  if (type === 'free') {
    doEnroll('free')
  } else if (type === 'points') {
    confirmPointsEnroll()
  } else if (type === 'paid') {
    // 打开凭证上传弹窗
    voucherNote.value = ''
    voucherImage.value = ''
    showVoucherDialog.value = true
  }
}

/** 确认积分兑换 */
function confirmPointsEnroll() {
  const price = (course.value as any)?.pointsPrice || 0
  uni.showModal({
    title: '积分兑换确认',
    content: `将消耗 ${price} 积分兑换此课程，是否继续？`,
    success: (res) => {
      if (res.confirm) doEnroll('points')
    },
  })
}

/** 执行报名请求 */
async function doEnroll(enrollType: EnrollType, extra: { voucherUrl?: string; voucherNote?: string; accessCode?: string } = {}) {
  if (enrolling.value) return
  enrolling.value = true
  try {
    const courseId = course.value?.documentId
    if (!courseId) {
      uni.showToast({ title: '课程信息缺失', icon: 'none' })
      return
    }
    const result = await createEnrollment({
      course: courseId,
      enrollType,
      ...extra,
    })
    enrollment.value = result
    if (result.status === 'enrolled') {
      uni.showToast({ title: '报名成功', icon: 'success' })
    } else if (result.status === 'pending_review') {
      uni.showToast({ title: '已提交，等待审核', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '报名失败', icon: 'none' })
  } finally {
    enrolling.value = false
  }
}

/** 提交付费凭证 */
function submitVoucher() {
  if (!voucherImage.value) {
    uni.showToast({ title: '请上传付款凭证', icon: 'none' })
    return
  }
  showVoucherDialog.value = false
  doEnroll('paid', { voucherUrl: voucherImage.value, voucherNote: voucherNote.value })
}

/** 选择凭证图片 */
function chooseVoucherImage() {
  uni.chooseImage({
    count: 1,
    success: (res) => {
      const tempPath = res.tempFilePaths[0]
      // TODO: 上传到服务器获取 URL，当前简化为临时路径
      // 实际项目应调用上传 API 获取永久 URL
      voucherImage.value = tempPath
    },
  })
}

/** 提交开通码 */
function submitAccessCode() {
  if (!accessCodeInput.value.trim()) {
    uni.showToast({ title: '请输入开通码', icon: 'none' })
    return
  }
  showAccessCodeDialog.value = false
  doEnroll('code', { accessCode: accessCodeInput.value.trim() })
  accessCodeInput.value = ''
}

function startLearning(index: number) {
  const lesson = lessons.value[index]
  if (!lesson) return

  // 报名门禁：需要报名但未开通时不允许学习
  if (!canLearn.value) {
    uni.showToast({ title: '请先完成报名', icon: 'none' })
    return
  }

  // 顺序锁定检查
  const lockResult = getLessonLockStatus(lesson)
  if (lockResult.locked) {
    lockDialogMode.value = lockResult.enforceMode
    lockDialogReason.value = lockResult.reason
    // 找到前置未完成课时的索引
    const firstIncompleteId = lockResult.firstIncomplete?.documentId
    lockGotoLessonIndex.value = lessons.value.findIndex(l => l.documentId === firstIncompleteId)
    lockOriginalLessonIndex.value = index
    lockDialogVisible.value = true
    return
  }

  navigateToLesson(index)
}

// 实际跳转到播放页
function navigateToLesson(index: number) {
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

// 顺序锁定弹窗：去学习前置课时
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockGotoLessonIndex.value >= 0) {
    navigateToLesson(lockGotoLessonIndex.value)
  }
}

// 顺序锁定弹窗：软锁跳过，继续学习原课时
function handleLockSkip() {
  lockDialogVisible.value = false
  if (lockOriginalLessonIndex.value >= 0) {
    navigateToLesson(lockOriginalLessonIndex.value)
  }
}

function goBack() {
  uni.navigateBack()
}

function goToCourse(courseId: string) {
  uni.navigateTo({ url: `/pages/course-detail/course-detail?courseId=${courseId}` })
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
  // 静默读取用户角色（用于考试/刷题等角色门控），未登录忽略
  getMyRoles().then((r) => { myRoles.value = Array.isArray(r) ? r : [] }).catch(() => { myRoles.value = [] })
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

  &.locked {
    background: #ffe0e0;
    color: #e74c3c;
  }

  &.soft-locked {
    background: #fff4e0;
    color: #f39c12;
  }
}

.quiz-entries {
  margin: 20rpx 30rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}
.quiz-entry {
  min-width: 180rpx;
  text-align: center;
  padding: 18rpx 30rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  color: #667eea;
  background: #e8eaf6;
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

.start-btn.disabled {
  background: #ccc;
}

.start-btn text {
  font-size: 30rpx;
  font-weight: bold;
  color: #fff;
}

.bottom-actions {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.access-code-link {
  padding: 16rpx 24rpx;
}

.access-code-link text {
  font-size: 26rpx;
  color: #667eea;
}

.enroll-status-tip {
  font-size: 24rpx;
  color: #e6a23c;
  margin: 8rpx 0;
  text-align: center;
}

/* 弹窗样式 */
.dialog-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.dialog-content {
  width: 600rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 32rpx;
}

.dialog-title {
  font-size: 32rpx;
  font-weight: bold;
  text-align: center;
  margin-bottom: 24rpx;
}

.dialog-body {
  margin-bottom: 24rpx;
}

.voucher-upload {
  width: 100%;
  height: 300rpx;
  border: 2rpx dashed #ddd;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.voucher-preview {
  width: 100%;
  height: 100%;
}

.upload-placeholder text {
  font-size: 28rpx;
  color: #999;
}

.voucher-note-input {
  width: 100%;
  height: 120rpx;
  border: 2rpx solid #eee;
  border-radius: 8rpx;
  padding: 16rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}

.access-code-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #eee;
  border-radius: 8rpx;
  padding: 0 16rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.dialog-actions {
  display: flex;
  gap: 20rpx;
}

.dialog-btn {
  flex: 1;
  text-align: center;
  padding: 20rpx 0;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.dialog-btn.cancel {
  background: #f5f5f5;
  color: #666;
}

.dialog-btn.confirm {
  background: #667eea;
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

/* 进阶课程 / 续学推荐 */
.related-section {
  margin-top: 20rpx;
  background: #fff;
  padding: 25rpx 0;
}
.related-title {
  padding: 0 30rpx 20rpx;
}
.related-title-text {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
}
.related-scroll {
  white-space: nowrap;
  padding-left: 30rpx;
}
.related-card {
  display: inline-block;
  width: 220rpx;
  margin-right: 20rpx;
  background: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  overflow: hidden;
  vertical-align: top;
}
.related-cover {
  width: 100%;
  height: 130rpx;
  background: #f0f0f0;
  display: block;

  &.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 60rpx;
  }
}
.related-name {
  display: block;
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
  padding: 12rpx 16rpx 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.related-meta {
  padding: 8rpx 16rpx 16rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.related-badge {
  font-size: 20rpx;
  color: #fff;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}
.related-level {
  font-size: 20rpx;
  color: #667eea;
  background: #e8eaf6;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}
.related-price {
  font-size: 22rpx;
  color: #f5222d;
  font-weight: bold;
}
</style>
