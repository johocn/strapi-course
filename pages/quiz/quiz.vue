<template>
  <view class="page-container">
    <view class="quiz-header">
      <text class="quiz-progress">第 {{ currentIndex + 1 }} / {{ questions.length }} 题</text>
      <text class="quiz-score">得分: {{ score }}</text>
    </view>

    <view v-if="questions.length > 0 && !quizFinished" class="quiz-content">
      <view class="question-card">
        <view class="question-type">
          <text>{{ getQuestionTypeText(currentQuestion.type) }}</text>
        </view>
        <text class="question-text">{{ currentQuestion.content }}</text>
        
        <view class="options-list">
          <view 
            v-for="(option, index) in currentQuestion.options" 
            :key="index"
            :class="['option-item', { selected: selectedAnswers.includes(index), correct: showResult && currentQuestion.answer.includes(index), wrong: showResult && selectedAnswers.includes(index) && !currentQuestion.answer.includes(index) }]"
            @click="selectOption(index)"
          >
            <text class="option-letter">{{ getOptionLetter(index) }}</text>
            <text class="option-content">{{ option }}</text>
            <text v-if="showResult && currentQuestion.answer.includes(index)" class="option-icon correct">✓</text>
            <text v-if="showResult && selectedAnswers.includes(index) && !currentQuestion.answer.includes(index)" class="option-icon wrong">✗</text>
          </view>
        </view>
      </view>

      <view v-if="showResult && isCurrentCorrect && pointsConfig.enabled" class="points-hint">
        <text class="points-text">+{{ earnedPointsPerQuestion[currentIndex] ?? 0 }} 积分</text>
      </view>

      <view class="quiz-action">
        <button 
          v-if="showResult" 
          :class="['action-btn', 'next-btn']" 
          @click="nextQuestion"
        >
          {{ currentIndex < questions.length - 1 ? '下一题' : '查看结果' }}
        </button>
        <button
          v-else
          :class="['action-btn', 'submit-btn', { disabled: selectedAnswers.length === 0 }]"
          :disabled="submitting"
          @click="submitAnswer"
        >
          提交答案
        </button>
      </view>
    </view>

    <view v-if="quizFinished" class="result-card">
      <view class="result-header">
        <text class="result-title">🎉 答题完成</text>
      </view>
      <view class="result-stats">
        <view class="stat-item">
          <text class="stat-value">{{ correctCount }}/{{ questions.length }}</text>
          <text class="stat-label">正确率</text>
        </view>
        <view v-if="pointsConfig.enabled" class="stat-item">
          <text class="stat-value">+{{ totalEarned }}</text>
          <text class="stat-label">获得积分</text>
        </view>
      </view>
      <view class="result-message">
        <text v-if="correctRate >= 100">太棒了！满分通过！🌟</text>
        <text v-else-if="correctRate >= 60">不错哦！继续加油！💪</text>
        <text v-else>需要再接再厉，重新学习课程后再来挑战吧！📚</text>
      </view>
      <view class="result-actions">
        <button v-if="pointsConfig.enabled && totalEarned > 0 && !pointsClaimed" class="action-btn claim-btn" :disabled="claiming" @click="claimPoints">领取积分</button>
        <button class="action-btn retry-btn" @click="retryQuiz">重新答题</button>
        <button class="action-btn back-btn" @click="goBack">返回课程</button>
      </view>
    </view>

    <view v-if="loading" class="loading"><text>加载中...</text></view>
    <view v-else-if="questions.length === 0" class="empty-state">
      <text class="empty-icon">📝</text>
      <text class="empty-text">暂无题目</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { startQuiz as apiStartQuiz, checkQuizAnswer, claimQuizPoints } from '../../services/api'
import type { Question } from '../../services/api'
import { getStoredAuthConfig } from '../../services/auth-config'

const questions = ref<Question[]>([])
const currentIndex = ref(0)
const selectedAnswers = ref<number[]>([])
const showResult = ref(false)
const score = ref(0)
const correctCount = ref(0)
const quizFinished = ref(false)
const earnedPointsPerQuestion = ref<number[]>([])
const pointsConfig = ref<any>({ enabled: false, perQuestionPoints: 0, pointsType: 'none', totalQuestions: 0 })
const courseDocumentId = ref<string | null>(null)
const pointsClaimed = ref(false)
const lessonId = ref('')
const loading = ref(false)
const submitting = ref(false)
const claiming = ref(false)
const siteConfig = getStoredAuthConfig()

// 渠道配置（受 channel_cross_points flag 控制）
const channelConfig = ref<any>(null)
const featureFlagChannelCrossPoints = ref(false)

const currentQuestion = computed(() => questions.value[currentIndex.value])
const correctRate = computed(() => questions.value.length > 0 ? Math.round((correctCount.value / questions.value.length) * 100) : 0)
const isCurrentCorrect = computed(() => {
  if (!showResult.value) return false
  return arraysEqual([...selectedAnswers.value].sort(), [...currentQuestion.value.answer].sort())
})
const totalEarned = computed(() => earnedPointsPerQuestion.value.reduce((sum, p) => sum + p, 0))

function getQuestionTypeText(type: string): string {
  const typeMap: Record<string, string> = {
    single: '单选题',
    multiple: '多选题',
    judgment: '判断题'
  }
  return typeMap[type] ?? '单选题'
}

function getOptionLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

function selectOption(index: number) {
  if (showResult.value) return
  
  if (currentQuestion.value.type === 'single' || currentQuestion.value.type === 'judgment') {
    selectedAnswers.value = [index]
  } else {
    const idx = selectedAnswers.value.indexOf(index)
    if (idx > -1) {
      selectedAnswers.value.splice(idx, 1)
    } else {
      selectedAnswers.value.push(index)
    }
  }
}

async function submitAnswer() {
  if (submitting.value) return
  if (selectedAnswers.value.length === 0) {
    uni.showToast({ title: '请选择答案', icon: 'none' })
    return
  }
  submitting.value = true

  try {
    const userAnswer = selectedAnswers.value.map(i => getOptionLetter(i)).join(',')
    const res = await checkQuizAnswer({ quizDocumentId: (currentQuestion.value as any)?.documentId, userAnswer })
    showResult.value = true

    if (res.isCorrect) {
      correctCount.value++
      let earned = 0
      if (pointsConfig.value.enabled) {
        if (pointsConfig.value.pointsType === 'quiz_points') {
          earned = (currentQuestion.value as any)?.points ?? 0
        } else {
          earned = pointsConfig.value.perQuestionPoints
        }
      }
      earnedPointsPerQuestion.value.push(earned)
    } else {
      earnedPointsPerQuestion.value.push(0)
    }
  } catch (e) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

function nextQuestion() {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
    selectedAnswers.value = []
    showResult.value = false
  } else {
    quizFinished.value = true
  }
}

async function claimPoints() {
  if (claiming.value) return
  if (!courseDocumentId.value) return
  claiming.value = true

  // 是否需要让用户选渠道：flag=true + specific 模式 + channelIds 多个
  const needPicker = featureFlagChannelCrossPoints.value
    && channelConfig.value
    && channelConfig.value.channelScope === 'specific'
    && Array.isArray(channelConfig.value.channelIds)
    && channelConfig.value.channelIds.length > 1

  const doClaim = async (selectedChannelId?: number | string) => {
    try {
      const claimRes = await claimQuizPoints({
        courseDocumentId: courseDocumentId.value!,
        totalEarnedPoints: totalEarned.value,
        selectedChannelId,
      })
      const earned = (claimRes as any)?.pointsEarned ?? 0
      pointsClaimed.value = true
      uni.showToast({ title: `获得${earned}积分！`, icon: 'success' })
    } catch (e: any) {
      const errMsg = (e as any)?.error || '积分领取失败'
      uni.showToast({ title: errMsg, icon: 'none' })
    } finally {
      claiming.value = false
    }
  }

  // 弹选渠道 UI
  if (needPicker) {
    const channelIds: any[] = channelConfig.value.channelIds
    const labels = channelIds.map((id) => {
      const isDefault = String(id) === String(channelConfig.value.pointChannelId)
      return `${id}${isDefault ? '（默认）' : ''}`
    })
    uni.showActionSheet({
      itemList: labels,
      success: (res) => {
        const picked = channelIds[res.tapIndex]
        doClaim(picked)
      },
      fail: () => {
        // 取消选择时使用默认 pointChannel
        doClaim(channelConfig.value.pointChannelId ?? undefined)
      }
    })
    return
  }

  // 不需要选：直接用默认 pointChannel（后端兜底）
  doClaim()
}

function retryQuiz() {
  currentIndex.value = 0
  selectedAnswers.value = []
  showResult.value = false
  score.value = 0
  correctCount.value = 0
  quizFinished.value = false
  earnedPointsPerQuestion.value = []
  pointsClaimed.value = false
  loadQuestions()
}

function goBack() {
  uni.navigateBack()
}

async function loadQuestions() {
  loading.value = true
  try {
    lessonId.value = uni.getStorageSync('currentLessonId') ?? ''

    if (!lessonId.value) {
      questions.value = []
      return
    }

    const res = await apiStartQuiz({ lessonDocumentId: lessonId.value, count: 2 })
    questions.value = res.questions ?? []
    pointsConfig.value = res.pointsConfig ?? { enabled: false, perQuestionPoints: 0, pointsType: 'none', totalQuestions: 0 }
    courseDocumentId.value = res.courseDocumentId ?? null
    channelConfig.value = res.channelConfig ?? null
    featureFlagChannelCrossPoints.value = !!(res.featureFlags && res.featureFlags.channel_cross_points)
  } catch (e: any) {
    const errMsg = (e as any)?.error ?? '加载题目失败'
    uni.showToast({ title: errMsg, icon: 'none' })
    questions.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '答题' })
  // #endif
  loadQuestions()
})
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
}

.quiz-header {
  display: flex;
  justify-content: space-between;
  padding: 30rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.quiz-progress {
  font-size: 28rpx;
  color: #fff;
}

.quiz-score {
  font-size: 28rpx;
  color: #fff;
  font-weight: bold;
}

.quiz-content {
  padding: 30rpx;
}

.question-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.question-type {
  display: inline-block;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  margin-bottom: 20rpx;
}

.question-type text {
  font-size: 24rpx;
  color: #fff;
}

.question-text {
  display: block;
  font-size: 34rpx;
  color: #333;
  line-height: 1.6;
  margin-bottom: 30rpx;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 25rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s;
  
  &.selected {
    background: #e8eaf6;
    border-color: #667eea;
  }
  
  &.correct {
    background: #e8f5e9;
    border-color: #4caf50;
  }
  
  &.wrong {
    background: #ffebee;
    border-color: #f44336;
  }
}

.option-letter {
  width: 48rpx;
  height: 48rpx;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: bold;
  color: #667eea;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.option-content {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.option-icon {
  font-size: 32rpx;
  font-weight: bold;
  
  &.correct {
    color: #4caf50;
  }
  
  &.wrong {
    color: #f44336;
  }
}

.points-hint {
  text-align: center;
  padding: 16rpx;
  margin-top: 20rpx;
}

.points-text {
  font-size: 32rpx;
  color: #ff9800;
  font-weight: bold;
}

.quiz-action {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.05);
}

.action-btn {
  width: 100%;
  height: 90rpx;
  border-radius: 45rpx;
  font-size: 32rpx;
  font-weight: bold;
  border: none;
  
  &.submit-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    
    &.disabled {
      opacity: 0.5;
    }
  }
  
  &.next-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
  }
  
  &.claim-btn {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    color: #fff;
    margin-bottom: 15rpx;
  }
  
  &.retry-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    margin-bottom: 15rpx;
  }
  
  &.back-btn {
    background: #f5f5f5;
    color: #666;
  }
}

.result-card {
  margin: 30rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  text-align: center;
}

.result-header {
  margin-bottom: 40rpx;
}

.result-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 40rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  display: block;
  font-size: 26rpx;
  color: #999;
  margin-top: 10rpx;
}

.result-message {
  font-size: 30rpx;
  color: #666;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 16rpx;
  margin-bottom: 40rpx;
}

.result-actions {
  display: flex;
  flex-direction: column;
}

.empty-state {
  padding: 100rpx 30rpx;
  text-align: center;
}

.loading {
  padding: 100rpx 30rpx;
  text-align: center;
}

.loading text {
  font-size: 28rpx;
  color: #999;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
}
</style>
