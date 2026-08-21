<template>
  <view class="page-container">
    <!-- 顶部进度 -->
    <view v-if="!finished" class="quiz-header">
      <text class="quiz-progress">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</text>
      <text class="quiz-score">答对 {{ correctCount }} · {{ Math.round(correctRate) }}%</text>
    </view>

    <!-- 答题区 -->
    <view v-if="!finished && questions.length > 0" class="quiz-content">
      <view class="question-card">
        <view class="question-meta">
          <text class="question-type">{{ typeText(currentQuestion.type) }}</text>
          <text v-if="currentQuestion.difficulty" class="question-diff">{{ difficultyText(currentQuestion.difficulty) }}</text>
          <text v-if="currentQuestion.reviewLevel" class="question-review">复习{{ currentQuestion.reviewLevel }}/5</text>
        </view>
        <rich-text class="question-text" :nodes="currentQuestion.title"></rich-text>

        <!-- 选项类题型 -->
        <view v-if="isChoice" class="options-list">
          <view
            v-for="(opt, index) in options"
            :key="opt.key"
            :class="['option-item', { selected: selectedKeys.includes(opt.key) }]"
            @click="toggleOpt(opt)"
          >
            <text class="option-letter">{{ optionLabel(index) }}</text>
            <text class="option-content">{{ opt.text }}</text>
            <text v-if="selectedKeys.includes(opt.key)" class="option-check">✓</text>
          </view>
        </view>

        <!-- 填空题 -->
        <view v-else-if="currentQuestion.type === 'fill_blank'" class="free-input-row">
          <input v-model="freeText" class="free-input" placeholder="请输入答案" />
        </view>

        <!-- 简答 / 问答题 -->
        <view v-else-if="currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay'" class="free-input-row">
          <textarea v-model="freeText" class="free-textarea" placeholder="请输入你的回答" />
        </view>

        <!-- 作答反馈 -->
        <view v-if="showResult" class="feedback">
          <view :class="['feedback-banner', { correct: isResultRight, wrong: isResultWrong, pending: isResultPending }]">
            <text class="feedback-title">
              {{ isResultPending ? '⏳ 已提交，待老师批改' : (isResultRight ? '✅ 回答正确' : '❌ 回答错误') }}
            </text>
            <text v-if="!isResultPending" class="feedback-score">得分 {{ record?.score ?? 0 }}</text>
          </view>
          <view v-if="!isResultPending && correctAnswerText" class="feedback-answer">
            <text class="feedback-label">正确答案：</text>
            <text class="feedback-value">{{ correctAnswerText }}</text>
          </view>
          <view v-if="currentQuestion.explanation" class="feedback-explanation">
            <rich-text class="feedback-explain-text" :nodes="currentQuestion.explanation"></rich-text>
          </view>
        </view>
      </view>

      <view class="quiz-action">
        <button
          v-if="showResult"
          class="action-btn next-btn"
          @click="nextQuestion"
        >{{ currentIndex < questions.length - 1 ? '下一题' : '完成练习' }}</button>
        <button
          v-else
          :class="['action-btn', 'submit-btn', { disabled: !canSubmit }]"
          :disabled="submitting"
          @click="submitAnswer"
        >提交答案</button>
      </view>
    </view>

    <!-- 结果页 -->
    <view v-if="finished" class="result-card">
      <view class="result-icon">{{ resultRate >= 80 ? '🎉' : (resultRate >= 60 ? '💪' : '📖') }}</view>
      <text class="result-title">{{ resultRate >= 80 ? '回答棒极了！' : (resultRate >= 60 ? '继续加油！' : '再练练吧') }}</text>
      <view class="result-stats">
        <view class="stat-item">
          <text class="stat-value">{{ correctCount }}/{{ questions.length }}</text>
          <text class="stat-label">答对数</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ Math.round(resultRate) }}%</text>
          <text class="stat-label">正确率</text>
        </view>
      </view>
      <view v-if="mode === 'wrong'" class="result-tip">
        <text>连对足够次数的错题会自动清除，出错的会继续进入下一次复习。</text>
      </view>
      <view class="result-actions">
        <button class="action-btn retry-btn" @click="retry">再来一组</button>
        <button class="action-btn back-btn" @click="goBack">返回</button>
      </view>
    </view>

    <view v-if="loading" class="loading"><text>加载中...</text></view>
    <view v-else-if="!loading && questions.length === 0 && !finished" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">{{ mode === 'wrong' ? '当前没有待复习的错题' : '暂无题目' }}</text>
      <button class="action-btn back-btn empty-back" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import {
  getWrongQuizDue,
  getQuizQuestionList,
  submitQuizPracticeAnswer,
} from '../../services/api'
import {
  normalizeOptions,
  typeText,
  difficultyText,
  optionLabel,
  stripHtml,
  buildAnswer,
  type QuizOpt,
} from '../../utils/quiz-display'
import { getStoredAuthConfig } from '../../services/auth-config'

const siteConfig = getStoredAuthConfig()

type Mode = 'knowledge' | 'random' | 'free' | 'wrong'

interface WithWrongInfo {
  documentId: string
  title: string
  type: string
  options: any
  answer?: string
  explanation?: string
  difficulty?: string
  points?: number
  lessonDocumentId?: string
  reviewLevel?: number
  wrongCount?: number
}

const mode = ref<Mode>('random')
const courseDocumentId = ref('')
const lessonDocumentId = ref('')
const kpDocumentId = ref('')
const questions = ref<WithWrongInfo[]>([])
const loading = ref(false)
const submitting = ref(false)
const currentIndex = ref(0)
const selectedKeys = ref<string[]>([])
const freeText = ref('')
const showResult = ref(false)
const record = ref<any>(null)
const correctCount = ref(0)
const finished = ref(false)

const currentQuestion = computed(() => questions.value[currentIndex.value] ?? {} as WithWrongInfo)
const options = computed<QuizOpt[]>(() => {
  if (currentQuestion.value.type === 'true_false') {
    const o = normalizeOptions(currentQuestion.value.options)
    if (o.length > 0) return o
    return [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]
  }
  return normalizeOptions(currentQuestion.value.options)
})
const isChoice = computed(() => ['single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering'].includes(currentQuestion.value.type))
const canSubmit = computed(() => {
  const t = currentQuestion.value.type
  if (t === 'short_answer' || t === 'essay' || t === 'fill_blank') return (freeText.value ?? '').trim().length > 0
  if (t === 'multiple_choice') return selectedKeys.value.length > 0
  return selectedKeys.value.length > 0
})
const correctRate = computed(() => questions.value.length ? (correctCount.value / questions.value.length) * 100 : 0)
const resultRate = computed(() => questions.value.length ? (correctCount.value / questions.value.length) * 100 : 0)

const isResultRight = computed(() => record.value?.isCorrect === true)
const isResultWrong = computed(() => record.value?.isCorrect === false)
const isResultPending = computed(() => record.value?.isCorrect == null)
const correctAnswerText = computed(() => {
  const t = currentQuestion.value.type
  const ans = currentQuestion.value.answer
  if (ans == null || ans === '') return ''
  if (t === 'single_choice' || t === 'multiple_choice' || t === 'true_false') {
    const keys = String(ans).split(',').map((s) => s.trim())
    const opts = options.value
    return keys
      .map((k) => {
        const o = opts.find((x) => x.key === k)
        return o ? `${k}.${o.text}` : k
      })
      .join('；')
  }
  if (t === 'fill_blank') return ans
  return stripHtml(ans)
})

function toggleOpt(opt: QuizOpt) {
  if (showResult.value) return
  const t = currentQuestion.value.type
  if (t === 'multiple_choice') {
    const idx = selectedKeys.value.indexOf(opt.key)
    if (idx > -1) selectedKeys.value.splice(idx, 1)
    else selectedKeys.value.push(opt.key)
  } else {
    selectedKeys.value = [opt.key]
  }
}

async function loadQuestions() {
  loading.value = true
  try {
    let list: WithWrongInfo[] = []
    if (mode.value === 'wrong') {
      const res: any = await getWrongQuizDue(50)
      const items: any[] = res?.data ?? []
      list = items
        .map((it) => {
          const q = it?.quiz
          if (!q) return null
          return {
            documentId: q.documentId,
            title: q.title,
            type: q.type,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            difficulty: q.difficulty,
            points: q.points,
            lessonDocumentId: q.lesson?.documentId || it.lesson?.documentId,
            reviewLevel: it.reviewLevel || 1,
            wrongCount: it.wrongCount || 1,
          }
        })
        .filter(Boolean)
    } else {
      const res: any = lessonDocumentId.value
        ? await getQuizQuestionList({ lessonDocumentId: lessonDocumentId.value })
        : kpDocumentId.value
          ? await getQuizQuestionList({ courseDocumentId: courseDocumentId.value || undefined, knowledgePointDocumentId: kpDocumentId.value })
          : await getQuizQuestionList({ courseDocumentId: courseDocumentId.value || undefined })
      const raw: any[] = res?.data ?? []
      list = raw
        .filter((q) => q.isPublished !== false)
        .map((q) => ({
          documentId: q.documentId,
          title: q.title,
          type: q.type,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          difficulty: q.difficulty,
          points: q.points,
          lessonDocumentId: q.lesson?.documentId,
        }))
    }
    // 随机打散
    list = [...list].sort(() => Math.random() - 0.5)
    questions.value = list.slice(0, 20)
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '加载题目失败', icon: 'none' })
    questions.value = []
  } finally {
    loading.value = false
  }
}

async function submitAnswer() {
  if (submitting.value || !canSubmit.value) return
  submitting.value = true
  try {
    const answer = buildAnswer(
      currentQuestion.value.type,
      selectedKeys.value,
      options.value,
      freeText.value
    )
    const resRecord: any = await submitQuizPracticeAnswer({
      quizDocumentId: currentQuestion.value.documentId,
      answer,
      lessonDocumentId: currentQuestion.value.lessonDocumentId || undefined,
      mode: 'practice',
      practiceType: mode.value,
    })
    record.value = resRecord
    showResult.value = true
    if (resRecord?.isCorrect === true) correctCount.value++
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function nextQuestion() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    resetCurrent()
  } else {
    finished.value = true
  }
}

function resetCurrent() {
  selectedKeys.value = []
  freeText.value = ''
  showResult.value = false
  record.value = null
}

function retry() {
  currentIndex.value = 0
  correctCount.value = 0
  finished.value = false
  resetCurrent()
  loadQuestions()
}

function goBack() {
  uni.navigateBack()
}

onLoad((query) => {
  const m = (query as any)?.mode
  if (m === 'knowledge' || m === 'free' || m === 'wrong') mode.value = m
  else mode.value = 'random'
  courseDocumentId.value = (query as any)?.course ?? ''
  lessonDocumentId.value = (query as any)?.lesson ?? ''
  kpDocumentId.value = (query as any)?.kp ?? ''
})

onMounted(async () => {
  // #ifndef H5
  const titleMap: Record<string, string> = {
    wrong: '错题重练',
    knowledge: '知识点刷题',
    free: '自由答题',
    random: '随机刷题',
  }
  uni.setNavigationBarTitle({ title: titleMap[mode.value] ?? '随机刷题' })
  // #endif
  await loadQuestions()
})

onUnload(() => {
  /* noop */
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
  box-sizing: border-box;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  padding: 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.quiz-progress { font-size: 28rpx; color: #fff; }
.quiz-score { font-size: 28rpx; color: #fff; font-weight: bold; }

.quiz-content { padding: 30rpx; }

.question-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.question-meta { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; flex-wrap: wrap; }
.question-type {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  color: #fff;
}
.question-diff { font-size: 22rpx; color: #ff9800; background: #fff3e0; padding: 6rpx 16rpx; border-radius: 20rpx; }
.question-review { font-size: 22rpx; color: #667eea; background: #e8eaf6; padding: 6rpx 16rpx; border-radius: 20rpx; }

.question-text { display: block; font-size: 34rpx; color: #333; line-height: 1.6; margin-bottom: 30rpx; }

.options-list { display: flex; flex-direction: column; gap: 20rpx; }
.option-item {
  display: flex;
  align-items: center;
  padding: 25rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  transition: all 0.2s;
  &.selected { background: #e8eaf6; border-color: #667eea; }
}
.option-letter {
  width: 48rpx; height: 48rpx; background: #fff; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: bold; color: #667eea; margin-right: 20rpx; flex-shrink: 0;
}
.option-content { flex: 1; font-size: 30rpx; color: #333; }
.option-check { font-size: 32rpx; color: #667eea; }

.free-input-row { margin-top: 10rpx; }
.free-input { width: 100%; height: 90rpx; background: #f8f9fa; border-radius: 16rpx; padding: 0 24rpx; font-size: 30rpx; box-sizing: border-box; }
.free-textarea { width: 100%; min-height: 220rpx; background: #f8f9fa; border-radius: 16rpx; padding: 24rpx; font-size: 30rpx; line-height: 1.5; box-sizing: border-box; }

.feedback { margin-top: 30rpx; }
.feedback-banner {
  border-radius: 16rpx; padding: 20rpx; display: flex; justify-content: space-between; align-items: center;
  &.correct { background: #e8f5e9; }
  &.wrong { background: #ffebee; }
  &.pending { background: #fff8e1; }
}
.feedback-title { font-size: 30rpx; font-weight: bold; color: #333; }
.feedback-score { font-size: 26rpx; color: #666; }
.feedback-answer { margin-top: 16rpx; font-size: 28rpx; color: #4caf50; }
.feedback-label { color: #666; }
.feedback-value { font-weight: bold; }
.feedback-explanation { margin-top: 16rpx; background: #f8f9fa; border-radius: 12rpx; padding: 20rpx; }
.feedback-explain-text { font-size: 26rpx; color: #666; line-height: 1.6; }

.quiz-action {
  position: fixed; bottom: 0; left: 0; right: 0; padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff; box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}
.action-btn {
  width: 100%; height: 90rpx; border-radius: 45rpx; font-size: 32rpx; font-weight: bold; border: none;
  &.submit-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; &.disabled { opacity: 0.5; } }
  &.next-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
  &.retry-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; margin-bottom: 15rpx; }
  &.back-btn { background: #f5f5f5; color: #666; }
}

.result-card { margin: 30rpx; background: #fff; border-radius: 20rpx; padding: 40rpx; text-align: center; }
.result-icon { font-size: 80rpx; }
.result-title { display: block; font-size: 40rpx; font-weight: bold; color: #333; margin: 10rpx 0 30rpx; }
.result-stats { display: flex; justify-content: space-around; margin-bottom: 30rpx; }
.stat-value { display: block; font-size: 48rpx; font-weight: bold; color: #667eea; }
.stat-label { display: block; font-size: 26rpx; color: #999; margin-top: 10rpx; }
.result-tip { font-size: 24rpx; color: #999; background: #f8f9fa; border-radius: 12rpx; padding: 20rpx; margin-bottom: 30rpx; text-align: left; line-height: 1.5; }
.result-actions { display: flex; flex-direction: column; }

.loading, .empty-state { padding: 100rpx 30rpx; text-align: center; }
.loading text { font-size: 28rpx; color: #999; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; display: block; }
.empty-back { margin-top: 40rpx; width: 320rpx; }
</style>