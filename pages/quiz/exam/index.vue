<template>
  <view class="page-container">
    <!-- ===== 考试列表 ===== -->
    <view v-if="phase === 'list'">
      <view v-if="!canUse" class="empty-state">
        <text class="empty-icon">🔒</text>
        <text class="empty-text">未授权或未开启</text>
      </view>
      <view v-else-if="loading" class="loading"><text>加载中...</text></view>
      <view v-else-if="exams.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无可参加的考试</text>
      </view>
      <view v-else class="exam-list">
        <view v-for="(exam, idx) in exams" :key="exam.documentId ?? idx" class="exam-card">
          <text class="exam-title">{{ exam.title }}</text>
          <text v-if="exam.description" class="exam-desc">{{ exam.description }}</text>
          <view class="exam-meta">
            <text class="exam-meta-item">{{ exam.questionCount || '?' }} 题</text>
            <text class="exam-meta-item">{{ exam.totalPoints || 0 }} 分</text>
            <text class="exam-meta-item">{{ exam.timeLimit ? exam.timeLimit + ' 分钟' : '不限时' }}</text>
            <text class="exam-meta-item">及格 {{ exam.passScore ?? 60 }} 分</text>
          </view>
          <view class="exam-action">
            <button class="action-btn start-btn" :disabled="starting" @click="startExam(exam)">
              {{ starting ? '准备中...' : '开始考试' }}
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== 答题中 ===== -->
    <view v-else-if="phase === 'taking'">
      <view class="take-header">
        <text class="take-progress">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</text>
        <text v-if="remain > 0" class="take-timer">{{ fmtTimer(remain) }}</text>
      </view>

      <view class="take-content">
        <view class="question-card">
          <view class="question-meta">
            <text class="question-type">{{ typeText(current.type) }}</text>
            <text v-if="current.difficulty" class="question-diff">{{ difficultyText(current.difficulty) }}</text>
            <text class="question-pts">{{ current.points || 0 }} 分</text>
          </view>
          <rich-text class="question-text" :nodes="current.title"></rich-text>

          <view v-if="isChoice" class="options-list">
            <view
              v-for="(opt, index) in currentOpts"
              :key="opt.key"
              :class="['option-item', { selected: currentKeys.includes(opt.key) }]"
              @click="toggleOpt(opt)"
            >
              <text class="option-letter">{{ optionLabel(index) }}</text>
              <text class="option-content">{{ opt.text }}</text>
              <text v-if="currentKeys.includes(opt.key)" class="option-check">✓</text>
            </view>
          </view>

          <view v-else-if="current.type === 'fill_blank'" class="free-input-row">
            <input v-model="currentText" class="free-input" placeholder="请输入答案" />
          </view>
          <view v-else-if="current.type === 'short_answer' || current.type === 'essay'" class="free-input-row">
            <textarea v-model="currentText" class="free-textarea" placeholder="请输入你的回答" />
          </view>

          <view v-if="shortages.length" class="shortage">
            <text class="shortage-title">部分题型题目不足：</text>
            <text class="shortage-text">{{ shortages.join('；') }}</text>
          </view>
        </view>

        <view class="answer-nav">
          <view
            v-for="(q, qi) in questions"
            :key="q.documentId"
            :class="['nav-dot', { current: qi === currentIndex, answered: isAnswered(q.documentId) }]"
            @click="currentIndex = qi"
          >{{ qi + 1 }}</view>
        </view>
      </view>

      <view class="take-action">
        <view class="take-btn prev" @click="prevQuestion">
          {{ currentIndex > 0 ? '上一题' : '返回' }}
        </view>
        <button v-if="currentIndex < questions.length - 1" class="action-btn next-btn" @click="nextQuestion">下一题</button>
        <button v-else class="action-btn submit-exam-btn" :disabled="submitting" @click="confirmSubmit">交卷</button>
      </view>
    </view>

    <!-- ===== 成绩页 ===== -->
    <view v-else-if="phase === 'result'" class="result-card">
      <view class="result-icon">{{ resultData.isPassed ? '🎉' : '📖' }}</view>
      <text class="result-title">{{ resultData.isPassed ? '考试通过！' : '未通过，再接再厉' }}</text>
      <view class="result-score">
        <text class="score-num">{{ resultData.totalScore ?? 0 }}</text>
        <text class="score-total"> / {{ questionsTotalPoints }} 分</text>
      </view>
      <view class="result-meta">
        <text class="result-meta-item">及格线 {{ resultPassScore }} 分</text>
        <text v-if="resultData.duration" class="result-meta-item">用时 {{
          Math.floor(resultData.duration / 60) + '分' + (resultData.duration % 60) + '秒'
        }}</text>
      </view>
      <view class="result-tip">
        <text>本次考试做错的题目已自动加入错题集，可在「我的-错题集」中复习。</text>
      </view>
      <view class="result-actions">
        <button class="action-btn back-btn" @click="phase = 'list'; loadExams()">返回列表</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getQuizExamList,
  startQuizExam,
  submitQuizExam,
  getQuizPaper,
  type QuizExam,
} from '../../../services/api'
import {
  normalizeOptions,
  typeText,
  difficultyText,
  optionLabel,
  buildAnswer,
  type QuizOpt,
} from '../../../utils/quiz-display'
import { fetchAuthConfig, getStoredAuthConfig } from '../../../services/auth-config'
import { setupPageShare } from '../../../utils/share'

const siteConfig = getStoredAuthConfig()

const canUse = ref(true)

const phase = ref<'list' | 'taking' | 'result'>('list')
const loading = ref(false)
const starting = ref(false)
const submitting = ref(false)
const exams = ref<QuizExam[]>([])

const questions = ref<any[]>([])
const currentIndex = ref(0)
const answerMap = ref<Record<string, { keys: string[]; text: string }>>({})
const currentKeys = ref<string[]>([])
const currentText = ref('')
const shortages = ref<string[]>([])
const attemptDocumentId = ref('')
const examDocumentId = ref('')
const questionsTotalPoints = ref(0)
const resultPassScore = ref(60)

const remain = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const resultData = ref<{ totalScore?: number; isPassed?: boolean; duration?: number }>({})

const current = computed(() => questions.value[currentIndex.value] ?? {} as any)
const currentOpts = computed<QuizOpt[]>(() => {
  if (current.value.type === 'true_false') {
    const o = normalizeOptions(current.value.options)
    return o.length ? o : [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
  }
  return normalizeOptions(current.value.options)
})
const isChoice = computed(() => ['single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering'].includes(current.value.type))

function fmtTimer(s: number): string {
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

function isAnswered(qid: string): boolean {
  const a = answerMap.value[qid]
  if (!a) return false
  return a.keys.length > 0 || (a.text || '').trim().length > 0
}

async function loadExams() {
  if (!canUse.value) return
  loading.value = true
  try {
    const res: any = await getQuizExamList({ pageSize: 100 })
    exams.value = res?.data ?? []
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '加载失败', icon: 'none' })
    exams.value = []
  } finally {
    loading.value = false
  }
}

function startCountdown(seconds: number) {
  stopTimer()
  if (seconds <= 0) return
  remain.value = seconds
  timer = setInterval(() => {
    remain.value--
    if (remain.value <= 0) {
      remain.value = 0
      stopTimer()
      uni.showToast({ title: '时间到，自动交卷', icon: 'none' })
      submit()
    }
  }, 1000)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

async function startExam(exam: QuizExam) {
  if (starting.value) return
  starting.value = true
  try {
    const attempt: any = await startQuizExam({ examDocumentId: exam.documentId })
    const paper: any = await getQuizPaper(exam.documentId)
    attemptDocumentId.value = attempt?.documentId || attempt?.id
    examDocumentId.value = exam.documentId

    const qs: any[] = paper?.questions ?? []
    if (!qs.length) {
      uni.showToast({ title: '该考试暂无可作答题目', icon: 'none' })
      return
    }
    questions.value = qs
    answerMap.value = {}
    shortages.value = paper?.shortages ?? []
    questionsTotalPoints.value = qs.reduce((sum, q) => sum + (q.points || 0), 0)
    resultPassScore.value = Number(exam.passScore) || 60
    currentIndex.value = 0
    loadCurrent()
    phase.value = 'taking'
    startCountdown((Number(exam.timeLimit) || 0) * 60)
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '开始考试失败', icon: 'none' })
  } finally {
    starting.value = false
  }
}

function loadCurrent() {
  const q = current.value
  const a = answerMap.value[q.documentId]
  currentKeys.value = a?.keys ?? []
  currentText.value = a?.text ?? ''
}

function saveCurrent() {
  const q = current.value
  answerMap.value[q.documentId] = {
    keys: [...currentKeys.value],
    text: currentText.value,
  }
}

function toggleOpt(opt: QuizOpt) {
  const t = current.value.type
  if (t === 'multiple_choice') {
    const idx = currentKeys.value.indexOf(opt.key)
    if (idx > -1) currentKeys.value.splice(idx, 1)
    else currentKeys.value.push(opt.key)
  } else {
    currentKeys.value = [opt.key]
  }
}

function nextQuestion() {
  saveCurrent()
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    loadCurrent()
  }
}

function prevQuestion() {
  saveCurrent()
  if (currentIndex.value > 0) {
    currentIndex.value--
    loadCurrent()
  } else {
    phase.value = 'list'
    stopTimer()
  }
}

function confirmSubmit() {
  saveCurrent()
  uni.showModal({
    title: '确认交卷',
    content: `你已作答 ${questions.value.filter((q) => isAnswered(q.documentId)).length} / ${questions.value.length} 题，确认交卷吗？`,
    success: (res) => {
      if (res.confirm) submit()
    },
  })
}

async function submit() {
  if (submitting.value || !attemptDocumentId.value) return
  submitting.value = true
  try {
    const answers = questions.value.map((q) => ({
      quizDocumentId: q.documentId,
      answer: buildAnswerFor(q),
    }))
    const res: any = await submitQuizExam(attemptDocumentId.value, { answers })
    resultData.value = { totalScore: res?.totalScore, isPassed: res?.isPassed, duration: res?.duration }
    stopTimer()
    phase.value = 'result'
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '交卷失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function buildAnswerFor(q: any): any {
  const a = answerMap.value[q.documentId] ?? { keys: [], text: '' }
  const opts = q.type === 'true_false'
    ? (normalizeOptions(q.options).length ? normalizeOptions(q.options) : [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }])
    : normalizeOptions(q.options)
  return buildAnswer(q.type, a.keys, opts, a.text)
}

function applyExamGate() {
  const cfg = getStoredAuthConfig()
  canUse.value = !cfg || (cfg.exam !== false && cfg.moduleGranted?.exam !== false)
}

onShow(async () => {
  applyExamGate()
  const cfg = await fetchAuthConfig()
  if (cfg) {
    canUse.value = cfg.exam !== false && cfg.moduleGranted?.exam !== false
  }
  if (phase.value === 'list') loadExams()
  setupPageShare({ title: '考试模式' })
})

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '模拟考试' })
  // #endif
  applyExamGate()
  loadExams()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style lang="scss" scoped>
.page-container { min-height: 100vh; background: #f5f5f5; padding-bottom: 140rpx; box-sizing: border-box; }

/* 列表 */
.exam-list { padding: 30rpx; }
.exam-card { background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 24rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05); }
.exam-title { font-size: 34rpx; font-weight: bold; color: #333; display: block; }
.exam-desc { font-size: 26rpx; color: #999; display: block; margin-top: 10rpx; line-height: 1.5; }
.exam-meta { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 20rpx; }
.exam-meta-item { font-size: 24rpx; color: #667eea; background: #e8eaf6; padding: 6rpx 16rpx; border-radius: 20rpx; }
.exam-action { margin-top: 24rpx; }
.action-btn { width: 100%; height: 90rpx; border-radius: 45rpx; font-size: 32rpx; font-weight: bold; border: none; }
.start-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.next-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.submit-exam-btn { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: #fff; }
.back-btn { background: #f5f5f5; color: #666; }

/* 答题 */
.take-header { display: flex; justify-content: space-between; padding: 30rpx; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.take-progress { font-size: 28rpx; color: #fff; }
.take-timer { font-size: 32rpx; font-weight: bold; color: #ffe082; }
.take-content { padding: 30rpx; }
.question-card { background: #fff; border-radius: 20rpx; padding: 30rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.05); }
.question-meta { display: flex; align-items: center; gap: 14rpx; margin-bottom: 20rpx; }
.question-type { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 22rpx; padding: 6rpx 18rpx; border-radius: 20rpx; }
.question-diff { font-size: 22rpx; color: #ff9800; background: #fff3e0; padding: 6rpx 16rpx; border-radius: 20rpx; }
.question-pts { font-size: 22rpx; color: #666; }
.question-text { display: block; font-size: 34rpx; color: #333; line-height: 1.6; margin-bottom: 30rpx; }
.options-list { display: flex; flex-direction: column; gap: 20rpx; }
.option-item { display: flex; align-items: center; padding: 25rpx; background: #f8f9fa; border-radius: 16rpx; border: 2rpx solid transparent; transition: all 0.2s; &.selected { background: #e8eaf6; border-color: #667eea; } }
.option-letter { width: 48rpx; height: 48rpx; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28rpx; font-weight: bold; color: #667eea; margin-right: 20rpx; flex-shrink: 0; }
.option-content { flex: 1; font-size: 30rpx; color: #333; }
.option-check { font-size: 32rpx; color: #667eea; }
.free-input-row { margin-top: 10rpx; }
.free-input { width: 100%; height: 90rpx; background: #f8f9fa; border-radius: 16rpx; padding: 0 24rpx; font-size: 30rpx; box-sizing: border-box; }
.free-textarea { width: 100%; min-height: 220rpx; background: #f8f9fa; border-radius: 16rpx; padding: 24rpx; font-size: 30rpx; line-height: 1.5; box-sizing: border-box; }
.shortage { margin-top: 20rpx; background: #fff8e1; border-radius: 12rpx; padding: 16rpx; }
.shortage-title { font-size: 24rpx; color: #e65100; }
.shortage-text { font-size: 24rpx; color: #795548; }

.answer-nav { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 24rpx; }
.nav-dot { width: 64rpx; height: 64rpx; border-radius: 50%; background: #fff; color: #666; display: flex; align-items: center; justify-content: center; font-size: 26rpx; border: 2rpx solid #e0e0e0; &.current { background: #667eea; color: #fff; border-color: #667eea; } &.answered { border-color: #4caf50; color: #4caf50; background: #e8f5e9; } }

.take-action { position: fixed; bottom: 0; left: 0; right: 0; display: flex; gap: 20rpx; padding: 20rpx 30rpx; padding-bottom: calc(20rpx + env(safe-area-inset-bottom)); background: #fff; box-shadow: 0 -4rpx 20rpx rgba(0,0,0,0.05); }
.take-btn { height: 90rpx; line-height: 90rpx; padding: 0 30rpx; border-radius: 45rpx; font-size: 32rpx; color: #666; background: #f5f5f5; flex-shrink: 0; text-align: center; }
.action-btn.next-btn, .action-btn.submit-exam-btn { flex: 1; }

/* 结果 */
.result-card { margin: 30rpx; background: #fff; border-radius: 20rpx; padding: 40rpx; text-align: center; }
.result-icon { font-size: 80rpx; }
.result-title { display: block; font-size: 40rpx; font-weight: bold; color: #333; margin: 10rpx 0 30rpx; }
.result-score { display: flex; align-items: baseline; justify-content: center; }
.score-num { font-size: 88rpx; font-weight: bold; color: #667eea; }
.score-total { font-size: 30rpx; color: #999; }
.result-meta { display: flex; wrap: wrap; justify-content: center; gap: 24rpx; margin-top: 20rpx; }
.result-meta-item { font-size: 26rpx; color: #666; }
.result-tip { font-size: 24rpx; color: #999; background: #f8f9fa; border-radius: 12rpx; padding: 20rpx; margin: 30rpx 0; text-align: left; line-height: 1.5; }
.result-actions { display: flex; flex-direction: column; }

.loading, .empty-state { padding: 100rpx 30rpx; text-align: center; }
.loading text { font-size: 28rpx; color: #999; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; display: block; }
</style>