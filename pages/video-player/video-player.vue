<template>
  <view class="page-container">
    <view class="video-header">
      <view class="back-btn" @click="goBack">
        <text>← 返回</text>
      </view>
      <text class="header-title">{{ courseDetail?.title || '课程学习' }}</text>
      <view class="header-right">
        <text class="points-badge">⭐ {{ pointsBalance }}</text>
      </view>
    </view>

    <view class="video-player">
      <video
        v-if="mediaUrl"
        :id="videoId"
        :src="mediaUrl"
        :poster="posterUrl"
        :initial-time="initialTime"
        :controls="true"
        :show-fullscreen-btn="!!currentLesson?.video_url"
        :show-play-btn="true"
        :show-center-play-btn="true"
        :enable-progress-gesture="true"
        :autoplay="false"
        class="video-element"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @timeupdate="onTimeUpdate"
        @ended="onVideoEnded"
        @loadedmetadata="onLoadedMetadata"
      />
      <view v-else class="video-placeholder">
        <text class="play-icon">▶</text>
        <text class="placeholder-text">暂无音视频内容</text>
      </view>
    </view>

    <view class="lesson-list">
      <view class="section-header">
        <text class="section-title">课时列表</text>
        <text class="lesson-count">共 {{ lessons.length }} 课时</text>
      </view>
      <view 
        v-for="(lesson, index) in lessons" 
        :key="lesson.documentId" 
        :class="['lesson-item', { active: currentLessonIndex === index, completed: lesson.completed }]"
        @click="selectLesson(index)"
      >
        <view class="lesson-number">{{ index + 1 }}</view>
        <view class="lesson-info">
          <text class="lesson-title">{{ lesson.title }}</text>
          <text class="lesson-duration">⏱️ {{ formatDuration(lesson.progressDuration || lesson.duration || 0) }}<text v-if="earnedLessonIds.has(lesson.documentId)" class="earned-tag">积分已领</text></text>
          <view v-if="lesson.progressPercent > 0" class="lesson-progress">
            <view class="progress-bar-mini">
              <view class="progress-fill-mini" :style="{ width: lesson.progressPercent + '%' }"></view>
            </view>
            <text class="progress-text-mini">{{ lesson.progressPercent }}%</text>
          </view>
        </view>
        <view class="lesson-status">
          <text v-if="lesson.completed" class="completed-icon">✓</text>
          <text v-else-if="getLessonLockStatus(lesson).locked" :class="['lock-icon', { 'soft-lock': !getLessonLockStatus(lesson).enforceMode }]">{{ getLessonLockStatus(lesson).enforceMode ? '🔒' : '💡' }}</text>
          <text v-else-if="currentLessonIndex === index" class="playing-icon">▶</text>
        </view>
      </view>
    </view>

    <view v-if="showQuiz" class="quiz-overlay" @click="closeQuiz">
      <view class="quiz-modal" @click.stop>
        <view class="quiz-header">
          <text class="quiz-title">📝 课时测验</text>
          <view class="quiz-close" @click="closeQuiz">✕</view>
        </view>
        <view class="quiz-content">
          <view class="question-count">第 {{ currentQuestionIndex + 1 }} / {{ questions.length }} 题</view>
          <view class="question">
            <text class="question-text">{{ currentQuestion?.title }}</text>
          </view>
          <view class="options">
            <view 
              v-for="(option, idx) in currentQuestion?.options" 
              :key="idx"
              :class="['option-item', { selected: !showResult && selectedAnswers.includes(option.key), correct: showResult && isCorrect && isCorrectAnswer(option.key), wrong: showResult && selectedAnswers.includes(option.key) && !isCorrectAnswer(option.key) }]"
              @click="selectOption(option.key)"
            >
              <text class="option-key">{{ option.key }}</text>
              <text class="option-text">{{ option.text }}</text>
              <text v-if="showResult && isCorrect && isCorrectAnswer(option.key)" class="result-icon correct-icon">✓</text>
              <text v-if="showResult && selectedAnswers.includes(option.key) && !isCorrectAnswer(option.key)" class="result-icon wrong-icon">✗</text>
            </view>
          </view>
          <view v-if="showResult" class="result-section">
            <text :class="['result-text', isCorrect ? 'correct' : 'wrong']">
              {{ isCorrect ? `🎉 回答正确！+${earnedPointsPerQuestion[currentQuestionIndex] || 0}积分` : '😅 回答错误' + (quizRetryEnabled && currentRetryCount <= quizMaxRetryCount ? '，请再试一次' : '') }}
            </text>
            <text v-if="isCorrect && currentExplanation" class="explanation">
              {{ currentExplanation }}
            </text>
            <text v-if="isPracticeMode && isCorrect" class="practice-hint">（练习模式，不重复获积分）</text>
          </view>
        </view>
        <view class="quiz-footer">
          <view v-if="!showResult" class="submit-btn" @click="submitAnswer">
            <text>提交答案</text>
          </view>
          <view v-else-if="isCorrect && currentQuestionIndex < questions.length - 1" class="next-btn" @click="nextQuestion">
            <text>下一题</text>
          </view>
          <view v-else-if="isCorrect && currentQuestionIndex === questions.length - 1" class="complete-btn" @click="completeQuiz">
            <text>完成答题</text>
          </view>
          <view v-else-if="!isCorrect && quizRetryEnabled && currentRetryCount <= quizMaxRetryCount" class="retry-btn retry-again-btn" @click="retryCurrentQuestion">
            <text>再试一次 ({{ currentRetryCount }}/{{ quizMaxRetryCount }})</text>
          </view>
          <view v-else-if="!isCorrect && currentQuestionIndex < questions.length - 1" class="next-btn" @click="nextQuestion">
            <text>下一题</text>
          </view>
          <view v-else-if="!isCorrect && currentQuestionIndex === questions.length - 1" class="complete-btn" @click="completeQuiz">
            <text>完成答题</text>
          </view>
          <view v-else class="retry-btn" @click="retryQuiz">
            <text>重新学习</text>
          </view>
        </view>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="action-btn secondary" @click="goBack">
        <text>返回课程</text>
      </view>
      <view :class="['action-btn', 'primary', { disabled: isQuizButtonLocked || todayQuizCount >= maxDailyQuiz }]" @click="startQuiz">
        <text>{{ quizButtonText }}</text>
      </view>
    </view>

    <!-- 答题积分领取确认弹窗（一次性积分） -->
    <view v-if="showClaimConfirmDialog" class="claim-confirm-overlay">
      <view class="claim-confirm-modal">
        <view class="claim-confirm-icon">🎁</view>
        <view class="claim-confirm-title">确认领取积分</view>
        <view class="claim-confirm-desc">
          本次答题可获得
          <text class="claim-confirm-points">+{{ pendingClaimTotal }} 积分</text>
          （一次性领取，不可重复获得），是否确认领取？
        </view>
        <view class="claim-confirm-actions">
          <view class="claim-confirm-btn cancel" @click="onClaimCancel">
            <text>暂不领取</text>
          </view>
          <view class="claim-confirm-btn primary" @click="onClaimConfirm">
            <text>确认领取</text>
          </view>
        </view>
      </view>
    </view>

    <ChannelPicker
      v-model:visible="showChannelPicker"
      :channels="channelPickerList"
      :default-doc-id="String(channelConfig?.pointChannelId ?? '')"
      :quiz-info="{ successCount: quizSuccessCount, totalCount: questions.length, earnedPoints: pendingClaimTotal }"
      @confirm="onChannelConfirm"
      @cancel="onChannelCancel"
    />

    <!-- 顺序锁定弹窗 -->
    <SequenceLockDialog
      v-model:visible="lockDialogVisible"
      :enforce-mode="lockDialogMode"
      :reason="lockDialogReason"
      @goto="handleLockGoto"
      @skip="handleLockSkip"
    />

    <!-- 续播/完成弹窗 -->
    <view v-if="showResumeDialog" class="resume-overlay" @click.self="onResumeRestart">
      <view class="resume-modal">
        <view class="resume-icon">
          <text>{{ resumeMode === 'completed' ? '🎉' : '▶' }}</text>
        </view>
        <view class="resume-header">
          <text class="resume-title">{{ resumeMode === 'completed' ? '课时已完成' : '继续学习' }}</text>
        </view>
        <view class="resume-body">
          <text v-if="resumeMode === 'completed'" class="resume-desc">本课时已学习完成，是否去答题或重新学习？</text>
          <text v-else class="resume-desc">上次学到 <text class="resume-time">{{ resumePositionText }}</text>，从哪里继续？</text>
        </view>
        <view class="resume-actions">
          <view v-if="resumeMode === 'completed'" class="resume-btn primary" @click="onResumeGoQuiz">
            <text>去答题</text>
          </view>
          <view v-else class="resume-btn primary" @click="onResumeContinue">
            <text>▶ 从 {{ resumePositionText }} 继续</text>
          </view>
          <view class="resume-btn secondary" @click="onResumeRestart">
            <text>↺ 从头开始播放</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getCourseDetail, getLessonList, getMyLessonProgresses, submitLessonProgress, startQuiz as apiStartQuiz, checkQuizAnswer, claimQuizPoints, submitQuizAnswer, getPointBalance, getPointFeatureFlags, getPointRecordList, claimLessonPoints, request } from '../../services/api'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'
import { BASE_URL } from '../../utils/env'
import { checkItemLock, RETRY_MAP } from '../../utils/sequence-lock'
import { normalizeList, buildProgressMap, enrichLessons, findFirstIncompleteIndex, extractEarnedLessonIds, countTodayQuizRecords } from '../../utils/player-data'
import { decidePlaybackAction, formatTime, formatDuration, computeProgress } from '../../utils/player-playback'
import { isCorrectAnswer as judgeCorrectAnswer, toggleSelection, computeEarnedPoints, canRetryAnswer, isQuizPracticeMode, canTakeFormalQuiz, sumEarnedPoints } from '../../utils/quiz-logic'
import { shouldShowChannelPicker, shouldFetchAvailableChannels, buildChannelOptions, dedupeChannels, buildChannelLabels } from '../../utils/points-store'
import type { Course, Lesson, QuizQuestion } from '../../services/api'
import ChannelPicker from '../../components/channel-picker.vue'
import SequenceLockDialog from '../../components/sequence-lock-dialog/sequence-lock-dialog.vue'

const courseDetail = ref<Course | null>(null)
const lessons = ref<(Lesson & { completed?: boolean; progressPercent?: number; progressId?: number; playPosition?: number; progressDuration?: number })[]>([])
const currentLessonIndex = ref(0)
const isPlaying = ref(false)
const progress = ref(0)
const currentTime = ref(0)
const duration = ref(0)
const initialTime = ref(0)
const pointsBalance = ref(0)
const showQuiz = ref(false)
const questions = ref<QuizQuestion[]>([])
const currentQuestionIndex = ref(0)
const selectedAnswers = ref<string[]>([])
const showResult = ref(false)
const isCorrect = ref(false)
const todayQuizCount = ref(0)
const maxDailyQuiz = ref(3)
const quizSuccessCount = ref(0)
const pointsConfig = ref<any>({ enabled: false, perQuestionPoints: 0, pointsType: 'none', totalQuestions: 0 })
const courseDocumentId = ref<string | null>(null)
const earnedPointsPerQuestion = ref<number[]>([])
const currentExplanation = ref('')
const currentCorrectAnswer = ref('')
const isPracticeMode = ref(false)
const currentRetryCount = ref(0)
const quizRetryEnabled = ref(true)
const quizMaxRetryCount = ref(1)
const earnedCourseIds = ref<Set<string>>(new Set())
const earnedLessonIds = ref<Set<string>>(new Set())
const featureFlagChannelCrossPoints = ref(false)
const channelConfig = ref<any>(null)

// 顺序锁定状态
const lockDialogVisible = ref(false)
const lockDialogMode = ref(false)
const lockDialogReason = ref('')
const lockGotoLessonIndex = ref(-1)
const lockOriginalLessonIndex = ref(-1)

// 续播/完成弹窗状态
const showResumeDialog = ref(false)
const resumeMode = ref<'resume' | 'completed'>('resume')
const resumePositionText = ref('')
// 会话级记忆：同一课时只弹一次提示，之后再次进入直接断点续播/从头播放
const resumeShownSet = ref<Set<string>>(new Set())

// 课程级答题控制字段（从 courseDetail 读取）
const courseAllowRetakeQuiz = computed(() => courseDetail.value?.allowRetakeQuiz === true)
const courseQuizRetryCount = computed(() => {
  const val = courseDetail.value?.quizRetryCount
  return val ? (RETRY_MAP[val] ?? 0) : 0
})

// 答题按钮锁定状态（领分后锁定，allowRetakeQuiz=true 时跳过锁定）
const isQuizButtonLocked = computed(() => {
  if (courseAllowRetakeQuiz.value) return false
  const lid = currentLesson.value?.documentId
  if (!lid) return false
  return earnedLessonIds.value.has(lid)
})

// 答题按钮文案
const quizButtonText = computed(() => {
  if (isQuizButtonLocked.value) return '已完成答题'
  if (todayQuizCount.value >= maxDailyQuiz.value) return '今日答题已达上限'
  return '开始答题'
})

// 渠道选择弹窗
const showChannelPicker = ref(false)
const channelPickerList = ref<any[]>([])
const pendingClaimTotal = ref(0)
// 答题积分领取确认弹窗（一次性积分，领取前需用户确认）
const showClaimConfirmDialog = ref(false)

// 视频播放器相关
const videoId = 'lessonVideo'
let videoContext: any = null
let progressSaveTimer: number | null = null
let hasMarkedComplete = false

const hasEarnedPoints = computed(() => {
  const lid = currentLesson.value?.documentId
  return lid ? earnedLessonIds.value.has(lid) : false
})

const allLessonsEarned = computed(() => {
  if (lessons.value.length === 0) return false
  return lessons.value.every(l => earnedLessonIds.value.has(l.documentId))
})

const currentLesson = computed(() => lessons.value[currentLessonIndex.value])
const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])
const lessonCompleted = computed(() => currentLesson.value?.completed || false)

// 媒体源：优先 video_url，其次 audio_url（兼容音频课程）
const mediaUrl = computed(() => currentLesson.value?.video_url || currentLesson.value?.audio_url || '')

// 封面图：音频课时展示缩略图，提升体验
const posterUrl = computed(() => {
  const t = (currentLesson.value as any)?.thumbnail
  const url = (t as any)?.url
  if (!url) return ''
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
})

async function loadData() {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const options = (currentPage as any)?.options || {}
  const courseId = options.courseId || '1'
  const lessonIndex = options.lessonIndex ? parseInt(options.lessonIndex) : 0
  
  try {
    const [courseRes, lessonsRes, progressRes] = await Promise.all([
      getCourseDetail(courseId),
      getLessonList(courseId),
      getMyLessonProgresses(courseId),
    ])
    courseDetail.value = courseRes || null
    courseDocumentId.value = (courseRes as any)?.documentId || courseId
    
    // 处理课时列表数据（可能是数组或 { data: [...] } 结构）
    const lessonData = normalizeList<any>(lessonsRes)
    
    // 处理进度数据（可能是数组、单个对象或 { data: [...] } 结构）
    const progressData = normalizeList<any>(progressRes)

    // 用 documentId 匹配，避免 number/string 类型不一致导致 Map.get 失败
    const progressMap = buildProgressMap(progressData)
    
    // 调试日志
    console.log('[DEBUG] 课时列表:', lessonData.length, '条')
    console.log('[DEBUG] 进度列表:', progressData.length, '条')
    console.log('[DEBUG] 进度 Map keys:', [...progressMap.keys()])
    if (progressData.length > 0) {
      console.log('[DEBUG] 第一条进度数据:', JSON.stringify(progressData[0]))
    }

    lessons.value = enrichLessons(lessonData, progressMap)
    
    // 默认跳转到第一个未完成的课时（如果有未完成的）
    const firstIncompleteIndex = findFirstIncompleteIndex(lessons.value)
    // 如果有未完成课时，跳转到第一个未完成；否则使用 URL 指定的课时
    currentLessonIndex.value = firstIncompleteIndex >= 0 ? firstIncompleteIndex : lessonIndex

    // 处理当前课时播放：有保存进度弹续播提示，已完成弹去答题/重头提示
    offerLessonPlayback(currentLessonIndex.value)

    const balanceRes = await getPointBalance()
    pointsBalance.value = (balanceRes as any)?.balance || 0

    // 加载答题重试配置：课程级 quizRetryCount 替代全局 flag
    try {
      const flagsRes = await getPointFeatureFlags()
      if (flagsRes) {
        // quizRetryEnabled/quizMaxRetryCount 改为从课程级字段读取
        const retryCount = courseQuizRetryCount.value
        quizRetryEnabled.value = retryCount > 0
        quizMaxRetryCount.value = retryCount
        maxDailyQuiz.value = flagsRes.maxDailyQuiz ?? 3
        featureFlagChannelCrossPoints.value = !!(flagsRes as any).channel_cross_points
      }
    } catch {}

    // 加载已领积分的课时（source 存的是 lessonDocumentId），同时计算今日答题次数
    try {
      const recordRes = await getPointRecordList({ action: 'quiz_pass', pageSize: 200 })
      const records = (recordRes as any)?.data?.records || []
      const lids = extractEarnedLessonIds(records)
      const today = new Date().toISOString().slice(0, 10)
      const todayCount = countTodayQuizRecords(records, today)
      earnedLessonIds.value = lids
      todayQuizCount.value = todayCount
    } catch {}

    // 配置微信分享（课程标题、课时信息）
    // #ifdef H5
    if (courseDetail.value) {
      const currentLesson = lessons.value[currentLessonIndex.value]
      setupPageShare({
        title: courseDetail.value.title,
        desc: currentLesson?.title || courseDetail.value.description || '',
        imgUrl: courseDetail.value.coverUrl,
      })
    }
    // #endif
  } catch (e) {
    console.error('加载数据失败', e)
  }
}

function getVideoContext() {
  if (!videoContext) {
    videoContext = uni.createVideoContext(videoId)
  }
  return videoContext
}

/** 检查课时是否被顺序锁定 */
function getLessonLockStatus(lesson: any) {
  if (!lesson?.sequenceTag || (lesson.sequenceNumber ?? 0) === 0) {
    return { locked: false, enforceMode: false, reason: '', firstIncomplete: null }
  }
  const allItems = lessons.value
    .filter(l => l.sequenceTag && (l.sequenceNumber ?? 0) > 0)
    .map(l => ({
      documentId: l.documentId,
      title: l.title,
      sequenceNumber: l.sequenceNumber ?? 0,
      sequenceTag: l.sequenceTag,
      enforceSequence: l.enforceSequence ?? courseDetail.value?.enforceSequence ?? false,
      isCompleted: l.completed ?? false
    }))
  return checkItemLock(
    {
      documentId: lesson.documentId,
      title: lesson.title,
      sequenceNumber: lesson.sequenceNumber ?? 0,
      sequenceTag: lesson.sequenceTag,
      enforceSequence: lesson.enforceSequence ?? courseDetail.value?.enforceSequence ?? false,
      isCompleted: lesson.completed ?? false
    },
    allItems
  )
}

function selectLesson(index: number) {
  const lesson = lessons.value[index]
  if (!lesson) return

  // 顺序锁定检查
  const lockResult = getLessonLockStatus(lesson)
  if (lockResult.locked) {
    lockDialogMode.value = lockResult.enforceMode
    lockDialogReason.value = lockResult.reason
    const firstIncompleteId = lockResult.firstIncomplete?.documentId
    lockGotoLessonIndex.value = lessons.value.findIndex(l => l.documentId === firstIncompleteId)
    lockOriginalLessonIndex.value = index
    lockDialogVisible.value = true
    return
  }

  // 切换课前保存当前进度
  saveLearningProgress()

  currentLessonIndex.value = index
  hasMarkedComplete = false
  duration.value = lesson?.duration || 0

  // 切换视频源后需要重建 context
  videoContext = null
  nextTick(() => {
    getVideoContext()
  })
  // 有保存进度/已完成时弹续播或完成提示，否则从头开始
  offerLessonPlayback(index)
}

// 续播/完成提示：决定是弹窗还是直接从头开始
function offerLessonPlayback(index: number) {
  const lesson = lessons.value[index]
  if (!lesson) return
  // 先重置播放状态，用户未选择前不自动 seek
  initialTime.value = 0
  currentTime.value = 0
  progress.value = 0
  resumePositionText.value = lesson.playPosition > 0 ? formatTime(Math.floor(lesson.playPosition)) : ''

  const action = decidePlaybackAction(lesson, resumeShownSet.value)

  switch (action.type) {
    case 'restart':
      // 已完成：从头播放（播放位置在末尾无意义）
      playLessonFrom(0, true)
      break
    case 'resume':
      // 有进度：直接断点续播
      playLessonFrom(action.position, true)
      break
    case 'show_completed':
      // 已完成 → 去答题 / 从头开始
      resumeMode.value = 'completed'
      showResumeDialog.value = true
      resumeShownSet.value.add(lesson.documentId)
      break
    case 'show_resume':
      // 有保存进度 → 续播 / 从头开始
      resumeMode.value = 'resume'
      showResumeDialog.value = true
      resumeShownSet.value.add(lesson.documentId)
      break
    case 'start':
      // 无进度：从头开始（不自动播放，等待用户点击播放按钮）
      currentTime.value = 0
      progress.value = 0
      initialTime.value = 0
      break
  }
}

// 从指定位置开始播放（可选自动播放）
function playLessonFrom(seconds: number, shouldPlay = true) {
  const lesson = currentLesson.value
  if (!lesson) return
  initialTime.value = seconds
  currentTime.value = seconds
  duration.value = lesson.duration || 0
  progress.value = duration.value > 0 ? Math.min(100, (seconds / duration.value) * 100) : 0
  videoContext = null
  nextTick(() => {
    const ctx = getVideoContext()
    if (ctx) {
      ctx.seek(seconds)
      if (shouldPlay) ctx.play()
    }
  })
}

// 续播弹窗：从上次位置继续播放
function onResumeContinue() {
  showResumeDialog.value = false
  const pos = currentLesson.value?.playPosition || 0
  playLessonFrom(pos, true)
}

// 续播/完成弹窗：从头开始播放
function onResumeRestart() {
  showResumeDialog.value = false
  playLessonFrom(0, true)
}

// 完成弹窗：去答题
function onResumeGoQuiz() {
  showResumeDialog.value = false
  startQuiz()
}

// 视频事件处理
function onVideoPlay() {
  isPlaying.value = true
  startProgressSaveTimer()
}

function onVideoPause() {
  isPlaying.value = false
  stopProgressSaveTimer()
  saveLearningProgress()
}

function onTimeUpdate(e: any) {
  const curTime = Math.floor(e.detail.currentTime || 0)
  const dur = Math.floor(e.detail.duration || 0)
  
  currentTime.value = curTime
  const pct = computeProgress(curTime, dur)
  if (dur > 0) {
    duration.value = dur
    if (pct !== null) progress.value = pct
  }

  // 播放进度 >= 100% 标记完成
  if (progress.value >= 98 && !hasMarkedComplete) {
    markLessonComplete()
  }
}

function onVideoEnded() {
  isPlaying.value = false
  stopProgressSaveTimer()
  if (!hasMarkedComplete) {
    markLessonComplete()
  }
  saveLearningProgress()
}

function onLoadedMetadata(e: any) {
  const dur = Math.floor(e.detail.duration || 0)
  if (dur > 0) {
    duration.value = dur
  }
  // 视频元数据加载后，跳转到上次播放位置（比 initial-time 更可靠）
  if (initialTime.value > 0) {
    const ctx = getVideoContext()
    if (ctx) {
      ctx.seek(initialTime.value)
    }
  }
}

// 定时保存进度（每10秒）
function startProgressSaveTimer() {
  stopProgressSaveTimer()
  progressSaveTimer = setInterval(() => {
    saveLearningProgress()
  }, 10000) as unknown as number
}

function stopProgressSaveTimer() {
  if (progressSaveTimer) {
    clearInterval(progressSaveTimer)
    progressSaveTimer = null
  }
}

// 保存学习进度到后端
async function saveLearningProgress() {
  if (!courseDetail.value || !currentLesson.value) return null

  try {
    const res = await submitLessonProgress({
      lessonDocumentId: currentLesson.value.documentId,
      progress: Math.min(100, Math.round(progress.value)),
      playPosition: currentTime.value,
      duration: duration.value,
    })
    // 首次上报时返回的 progress 包含 id，回填给 lesson 用于领分
    const pid = (res as any)?.id
    if (pid) {
      currentLesson.value.progressId = pid
      lessons.value[currentLessonIndex.value].progressId = pid
    }
    return res
  } catch (e) {
    console.error('保存进度失败', e)
    return null
  }
}

async function markLessonComplete() {
  hasMarkedComplete = true
  const lesson = lessons.value[currentLessonIndex.value]
  if (!lesson) return

  if (!lesson.completed) {
    lesson.completed = true
    lesson.progressPercent = 100
    uni.showToast({ title: '课时完成！', icon: 'success' })
    const saved = await saveLearningProgress()
    if (saved && (saved as any).id && !lesson.progressId) {
      lesson.progressId = (saved as any).id
    }
    // 课时有积分（lesson_points 模式）→ 自动尝试领分；quiz_points 模式由答题链路领分
    if ((lesson as any).enablePoints && (lesson as any).pointsType === 'lesson_points' && lesson.progressId) {
      await tryClaimLessonPoints(lesson)
    }
  }
}

// 课时领分（受 channel_cross_points flag 控制渠道选择器）
async function tryClaimLessonPoints(lesson: any) {
  if (earnedLessonIds.value.has(lesson.documentId)) return

  const ch = (courseDetail.value as any) || {}
  const channelIds: any[] = Array.isArray(ch.channelIds) ? ch.channelIds : []
  const pointChannelId = ch.pointChannel?.id ?? ch.pointChannel ?? null

  // specific 模式 + flag=true + 多个候选渠道 → 弹选择器
  const needPicker = shouldShowChannelPicker(ch.channelScope, channelIds, featureFlagChannelCrossPoints.value)

  const doClaim = async (selectedChannelId?: number | string) => {
    try {
      const res = await claimLessonPoints(lesson.progressId, { selectedChannelId })
      const earned = (res as any)?.pointsEarned || 0
      pointsBalance.value += earned
      earnedLessonIds.value = new Set([...earnedLessonIds.value, lesson.documentId])
      uni.showToast({ title: `获得${earned}积分！`, icon: 'success' })
    } catch (e: any) {
      const errMsg = (e as any)?.error || '积分领取失败'
      uni.showToast({ title: errMsg, icon: 'none' })
    }
  }

  if (needPicker) {
    const labels = buildChannelLabels(channelIds, pointChannelId)
    uni.showActionSheet({
      itemList: labels,
      success: (res) => doClaim(channelIds[res.tapIndex]),
      fail: () => doClaim(pointChannelId || undefined)
    })
    return
  }

  doClaim()
}

function goToNext() {
  if (currentLessonIndex.value < lessons.value.length - 1) {
    selectLesson(currentLessonIndex.value + 1)
  }
}

// 顺序锁定弹窗：去学习前置课时
function handleLockGoto() {
  lockDialogVisible.value = false
  if (lockGotoLessonIndex.value >= 0) {
    // 直接切换到前置课时（已通过锁定检查或者前置课时自身无锁）
    saveLearningProgress()
    currentLessonIndex.value = lockGotoLessonIndex.value
    hasMarkedComplete = false
    videoContext = null
    offerLessonPlayback(lockGotoLessonIndex.value)
  }
}

// 顺序锁定弹窗：软锁跳过，继续学习原课时
function handleLockSkip() {
  lockDialogVisible.value = false
  if (lockOriginalLessonIndex.value >= 0) {
    saveLearningProgress()
    currentLessonIndex.value = lockOriginalLessonIndex.value
    hasMarkedComplete = false
    videoContext = null
    offerLessonPlayback(lockOriginalLessonIndex.value)
  }
}

function goBack() {
  saveLearningProgress()
  uni.navigateBack()
}

// 熄屏时间差补偿
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden' && isPlaying.value) {
    saveLearningProgress()
  }
}

async function startQuiz() {
  if (!currentLesson.value?.completed) {
    uni.showToast({ title: '请先完成学习', icon: 'none' })
    return
  }

  // 答题按钮锁定检查：领分后不允许重复答题（allowRetakeQuiz=true 时跳过此检查）
  if (isQuizButtonLocked.value) {
    uni.showToast({ title: '已完成答题，无法重复答题', icon: 'none' })
    return
  }

  // 检查是否已获得本课时积分（练习模式）
  const lid = currentLesson.value?.documentId
  isPracticeMode.value = lid ? isQuizPracticeMode(earnedLessonIds.value, lid) : false

  // 每日答题次数限制仅对正式答题（非练习模式）生效，练习模式不消耗次数
  if (!canTakeFormalQuiz(isPracticeMode.value, todayQuizCount.value, maxDailyQuiz.value)) {
    uni.showToast({ title: `今日答题次数已达上限(${maxDailyQuiz.value}次)`, icon: 'none' })
    return
  }
  
  try {
    const res = await apiStartQuiz({ lessonDocumentId: currentLesson.value.documentId, count: 2 })
    questions.value = res.questions || []
    pointsConfig.value = res.pointsConfig || { enabled: false, perQuestionPoints: 0, pointsType: 'none', totalQuestions: 0 }
    courseDocumentId.value = res.courseDocumentId || null
    channelConfig.value = res.channelConfig || null
    featureFlagChannelCrossPoints.value = !!(res.featureFlags && res.featureFlags.channel_cross_points)
  } catch (e: any) {
    const errMsg = (e as any)?.error || '获取题目失败'
    uni.showToast({ title: errMsg, icon: 'none' })
    return
  }
  
  currentQuestionIndex.value = 0
  selectedAnswers.value = []
  showResult.value = false
  showQuiz.value = true
  quizSuccessCount.value = 0
  earnedPointsPerQuestion.value = []
  currentRetryCount.value = 0

  if (isPracticeMode.value) {
    uni.showToast({ title: '练习模式（不重复获积分）', icon: 'none' })
  }
}

function isCorrectAnswer(key: string): boolean {
  return judgeCorrectAnswer(currentCorrectAnswer.value, key)
}

function selectOption(key: string) {
  if (showResult.value) return
  
  const questionType = currentQuestion.value?.type
  selectedAnswers.value = toggleSelection(selectedAnswers.value, key, questionType)
}

async function submitAnswer() {
  if (selectedAnswers.value.length === 0) {
    uni.showToast({ title: '请选择答案', icon: 'none' })
    return
  }
  
  try {
    const userAnswer = selectedAnswers.value.join(',')
    const res = await checkQuizAnswer({ quizDocumentId: currentQuestion.value?.documentId, userAnswer })
    isCorrect.value = res.isCorrect
    showResult.value = true
    currentExplanation.value = res.explanation || ''
    currentCorrectAnswer.value = res.correctAnswer || ''
    
    if (isCorrect.value) {
      quizSuccessCount.value++
      const earned = computeEarnedPoints(
        isCorrect.value,
        pointsConfig.value,
        isPracticeMode.value,
        currentQuestion.value,
        pointsConfig.value.perQuestionPoints
      )
      earnedPointsPerQuestion.value.push(earned)
    } else {
      // 答错：检查是否还有重试机会
      currentRetryCount.value++
      const canRetry = canRetryAnswer(quizRetryEnabled.value, currentRetryCount.value, quizMaxRetryCount.value)
      if (!canRetry) {
        earnedPointsPerQuestion.value.push(0)
      }
    }
  } catch (e) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
    selectedAnswers.value = []
    showResult.value = false
    currentRetryCount.value = 0
  }
}

async function completeQuiz() {
  // 练习模式不消耗每日答题次数
  if (!isPracticeMode.value) {
    todayQuizCount.value++
  }

  const totalEarned = sumEarnedPoints(earnedPointsPerQuestion.value)

  // 练习模式或无积分，直接关闭
  if (isPracticeMode.value || !pointsConfig.value.enabled || totalEarned <= 0) {
    showQuiz.value = false
    uni.showToast({ title: isPracticeMode.value ? '练习完成！' : '答题完成！', icon: 'success' })
    return
  }

  // 一次性积分：领取前弹确认框，避免误领
  pendingClaimTotal.value = totalEarned
  showClaimConfirmDialog.value = true
  // 先关闭答题遮罩（避免后续弹窗被遮挡）
  showQuiz.value = false
}

// 确认领取一次性积分
async function onClaimConfirm() {
  showClaimConfirmDialog.value = false
  await doClaimFlow(pendingClaimTotal.value)
}

// 取消领取一次性积分
function onClaimCancel() {
  showClaimConfirmDialog.value = false
  uni.showToast({ title: '已取消领取', icon: 'none' })
}

// 实际领取流程：获取渠道 → 单渠道直接领 / 多渠道弹选择器
async function doClaimFlow(totalEarned: number) {
  let availableChannels: any[] = []

  if (channelConfig.value && Array.isArray(channelConfig.value.channelIds)) {
    // specific 模式：channelIds 是 id 数组，fallback name 显示 id
    availableChannels = buildChannelOptions(channelConfig.value.channelIds)
  }

  if (shouldFetchAvailableChannels(channelConfig.value, availableChannels)) {
    try {
      const channelRes = await request('/zhao-common/v1/channels/available', { method: 'GET' })
      const channels = (channelRes as any)?.data || []
      // 去重保留完整对象
      availableChannels = dedupeChannels(channels)
    } catch (e) {
      console.warn('[获取可用渠道失败]', e)
    }
  }

  const needPicker = availableChannels.length > 1

  if (needPicker) {
    channelPickerList.value = availableChannels
    pendingClaimTotal.value = totalEarned
    showChannelPicker.value = true
  } else if (availableChannels.length === 1) {
    await claimWithChannel(availableChannels[0].documentId, totalEarned)
  } else {
    uni.showToast({ title: '无可选渠道', icon: 'none' })
  }
}

async function claimWithChannel(selectedChannelId: string, totalEarned: number) {
  try {
    const claimRes = await claimQuizPoints({
      courseDocumentId: courseDocumentId.value!,
      totalEarnedPoints: totalEarned,
      lessonDocumentId: currentLesson.value?.documentId,
      selectedChannelId,
    })
    const earned = (claimRes as any)?.pointsEarned || 0
    pointsBalance.value += earned
    // 领取积分成功后，立即把当前课时标记为已领积分，触发答题按钮置灰（allowRetakeQuiz=false 时）
    const lid = currentLesson.value?.documentId
    if (lid) earnedLessonIds.value.add(lid)
    uni.showToast({ title: `获得${earned}积分！`, icon: 'success' })
  } catch (e: any) {
    const errMsg = (e as any)?.error || '积分领取失败'
    uni.showToast({ title: errMsg, icon: 'none' })
  }
}

async function onChannelConfirm(selectedDocId: string) {
  await claimWithChannel(selectedDocId, pendingClaimTotal.value)
}

function onChannelCancel() {
  uni.showToast({ title: '已取消领取', icon: 'none' })
}

function retryCurrentQuestion() {
  selectedAnswers.value = []
  showResult.value = false
  isCorrect.value = false
}

function retryQuiz() {
  currentTime.value = 0
  progress.value = 0
  showQuiz.value = false
  // 重新播放视频
  const ctx = getVideoContext()
  if (ctx) {
    ctx.seek(0)
    ctx.play()
  }
}

function closeQuiz() {
  showQuiz.value = false
}

onMounted(() => {
  loadData()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onShow(() => {
  // H5 微信环境：刷新分享配置
  // #ifdef H5
  if (courseDetail.value) {
    const currentLesson = lessons.value[currentLessonIndex.value]
    setupPageShare({
      title: courseDetail.value.title,
      desc: currentLesson?.title || courseDetail.value.description || '',
      imgUrl: courseDetail.value.coverUrl,
    })
  }
  // #endif
})

onUnmounted(() => {
  stopProgressSaveTimer()
  saveLearningProgress()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.video-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.back-btn {
  color: #fff;
  font-size: 28rpx;
}

.header-title {
  color: #fff;
  font-size: 32rpx;
  font-weight: bold;
}

.header-right {
  display: flex;
  align-items: center;
}

.points-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 24rpx;
}

.video-player {
  background: #000;
  width: 100%;
}

.video-element {
  width: 100%;
  height: 420rpx;
}

.video-placeholder {
  width: 100%;
  height: 420rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #333;
}

.play-icon {
  font-size: 80rpx;
  color: rgba(255, 255, 255, 0.8);
}

.placeholder-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 28rpx;
  margin-top: 20rpx;
}

.lesson-list {
  padding: 20rpx 30rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.lesson-count {
  font-size: 26rpx;
  color: #999;
}

.lesson-item {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 20rpx;
  border-radius: 16rpx;
  margin-bottom: 15rpx;
  border: 2rpx solid transparent;
  
  &.active {
    border-color: #667eea;
    background: #f8f9ff;
  }
  
  &.completed {
    opacity: 0.7;
  }
}

.lesson-number {
  width: 50rpx;
  height: 50rpx;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: bold;
  color: #666;
  
  .completed & {
    background: #52c41a;
    color: #fff;
  }
  
  .active & {
    background: #667eea;
    color: #fff;
  }
}

.lesson-info {
  flex: 1;
  margin-left: 20rpx;
}

.lesson-title {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 8rpx;
}

.lesson-duration {
  font-size: 24rpx;
  color: #999;
  display: block;
}

.earned-tag {
  background: #ff9800;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  margin-left: 10rpx;
}

.lesson-progress {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}

.progress-bar-mini {
  flex: 1;
  height: 8rpx;
  background: #e8e8e8;
  border-radius: 4rpx;
  overflow: hidden;
}

.progress-fill-mini {
  height: 100%;
  background: #667eea;
  border-radius: 4rpx;
}

.progress-text-mini {
  font-size: 20rpx;
  color: #999;
  margin-left: 10rpx;
}

.lesson-status {
  margin-left: 15rpx;
}

.completed-icon {
  color: #52c41a;
  font-size: 32rpx;
}

.playing-icon {
  color: #667eea;
  font-size: 28rpx;
}

.lock-icon {
  font-size: 28rpx;
}

.lock-icon.soft-lock {
  font-size: 24rpx;
}

// 答题相关样式
.quiz-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.quiz-modal {
  width: 90%;
  max-height: 90vh;
  background: #fff;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  flex-shrink: 0;
}

.quiz-title {
  font-size: 32rpx;
  font-weight: bold;
}

.quiz-close {
  font-size: 36rpx;
  color: #999;
  padding: 10rpx;
}

.quiz-content {
  padding: 30rpx;
  flex: 1;
  overflow-y: auto;
}

.question-count {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 20rpx;
}

.question-text {
  font-size: 30rpx;
  color: #333;
  line-height: 1.6;
}

.options {
  margin-top: 30rpx;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 18rpx;
  margin-bottom: 10rpx;
  border: 2rpx solid #e8e8e8;
  border-radius: 12rpx;
  
  &.selected {
    border-color: #667eea;
    background: #f8f9ff;
  }
  
  &.correct {
    border-color: #52c41a;
    background: #f6ffed;
  }
  
  &.wrong {
    border-color: #ff4d4f;
    background: #fff2f0;
  }
}

.option-key {
  width: 50rpx;
  height: 50rpx;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: bold;
  color: #666;
  margin-right: 20rpx;
  flex-shrink: 0;
  
  .selected & {
    background: #667eea;
    color: #fff;
  }
  
  .correct & {
    background: #52c41a;
    color: #fff;
  }
  
  .wrong & {
    background: #ff4d4f;
    color: #fff;
  }
}

.option-text {
  font-size: 28rpx;
  color: #333;
  flex: 1;
}

.result-icon {
  font-size: 36rpx;
  font-weight: bold;
  flex-shrink: 0;
  
  &.correct-icon {
    color: #52c41a;
  }
  
  &.wrong-icon {
    color: #ff4d4f;
  }
}

.result-section {
  margin-top: 30rpx;
  padding: 24rpx;
  border-radius: 12rpx;
  background: #f8f9ff;
}

.result-text {
  font-size: 28rpx;
  font-weight: bold;
  
  &.correct {
    color: #52c41a;
  }
  
  &.wrong {
    color: #ff4d4f;
  }
}

.explanation {
  display: block;
  margin-top: 15rpx;
  font-size: 24rpx;
  color: #666;
}

.practice-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #ff9800;
}

.quiz-footer {
  padding: 30rpx;
  border-top: 1rpx solid #f0f0f0;
  flex-shrink: 0;
}

.submit-btn, .next-btn, .complete-btn, .retry-btn {
  padding: 24rpx;
  border-radius: 12rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: bold;
}

.submit-btn {
  background: #667eea;
  color: #fff;
}

.next-btn {
  background: #667eea;
  color: #fff;
}

.complete-btn {
  background: #52c41a;
  color: #fff;
}

.retry-btn {
  background: #ff9800;
  color: #fff;
}

.retry-again-btn {
  background: #667eea;
}

// 底部操作栏
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);
  gap: 20rpx;
}

.action-btn {
  flex: 1;
  padding: 24rpx;
  border-radius: 12rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: bold;
  
  &.primary {
    background: #667eea;
    color: #fff;
  }
  
  &.secondary {
    background: #f0f0f0;
    color: #666;
  }

  &.disabled {
    background: #ccc;
    color: #999;
    pointer-events: none;
  }
}

// 续播/完成弹窗
.resume-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;
}

.resume-modal {
  width: 78%;
  background: #fff;
  border-radius: 32rpx;
  padding: 48rpx 36rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.18);
  animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.resume-icon {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
}

.resume-header {
  margin-bottom: 16rpx;
}

.resume-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2937;
}

.resume-body {
  margin-bottom: 40rpx;
}

.resume-desc {
  font-size: 28rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
}

.resume-time {
  color: #667eea;
  font-weight: bold;
  font-size: 30rpx;
}

.resume-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.resume-btn {
  padding: 26rpx;
  border-radius: 16rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: bold;
  transition: transform 0.1s ease;

  &:active {
    transform: scale(0.97);
  }

  &.primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: #fff;
    box-shadow: 0 8rpx 20rpx rgba(102, 126, 234, 0.35);
  }

  &.secondary {
    background: #f3f4f6;
    color: #6b7280;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.85); }
  to { opacity: 1; transform: scale(1); }
}

/* 答题积分领取确认弹窗 */
.claim-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1150;
  animation: fadeIn 0.2s ease;
}

.claim-confirm-modal {
  width: 78%;
  background: #fff;
  border-radius: 32rpx;
  padding: 48rpx 36rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.18);
  animation: popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.claim-confirm-icon {
  width: 108rpx;
  height: 108rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 52rpx;
  margin-bottom: 24rpx;
  background: linear-gradient(135deg, #f6ad55, #ed8936);
  box-shadow: 0 8rpx 24rpx rgba(246, 173, 85, 0.4);
}

.claim-confirm-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 16rpx;
}

.claim-confirm-desc {
  font-size: 28rpx;
  color: #6b7280;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 40rpx;
}

.claim-confirm-points {
  color: #ed8936;
  font-weight: bold;
  font-size: 30rpx;
}

.claim-confirm-actions {
  width: 100%;
  display: flex;
  gap: 20rpx;
}

.claim-confirm-btn {
  flex: 1;
  padding: 26rpx;
  border-radius: 16rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: bold;

  &.cancel {
    background: #f3f4f6;
    color: #6b7280;
  }

  &.primary {
    background: linear-gradient(135deg, #f6ad55, #ed8936);
    color: #fff;
    box-shadow: 0 8rpx 20rpx rgba(237, 137, 54, 0.35);
  }
}
</style>
