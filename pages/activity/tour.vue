<template>
  <view class="tour-page">
    <!-- 加载中 -->
    <view v-if="loading" class="tour-state"><text>加载序章中...</text></view>
    <!-- 加载失败重试 -->
    <view v-else-if="!story" class="tour-state tour-state--retry" @click="loadStory">
      <text>加载失败，点击重试</text>
    </view>

    <template v-else-if="story">
      <!-- 序章：背景 + 选角 -->
      <view class="prologue">
        <text class="prologue-title">{{ story.title }}</text>
        <text class="prologue-backdrop">{{ story.backdrop }}</text>

        <view class="role-block" v-if="!progress?.role">
          <text class="role-tip">选择一个角色，开始你的故事</text>
          <view class="role-list">
            <view v-for="r in storyRoles" :key="r.id" class="role-item"
              :class="{ on: selectedRole === r.id }" @click="selectedRole = r.id">
              <text class="role-name">{{ r.name }}</text>
              <text v-if="r.desc" class="role-desc">{{ r.desc }}</text>
            </view>
          </view>
          <view class="role-action" @click="submitRole" :class="{ disabled: !selectedRole }">
            <text>{{ submittingRole ? '选择中...' : '选择角色进入' }}</text>
          </view>
        </view>
        <text class="role-chosen" v-else>当前角色：<text class="role-chosen-name">{{ currentRoleName }}</text></text>
      </view>

      <!-- 站点打卡 -->
      <view class="section">
        <view class="section-head"><text class="section-title">线路站点</text></view>
        <view class="station-list">
          <view v-for="s in stations" :key="s.order" class="station-item"
            :class="{ done: progressStations.includes(s.order) }">
            <text class="station-order">{{ s.order }}</text>
            <view class="station-body">
              <text class="station-name">{{ s.name }}</text>
              <text class="station-clue">{{ s.clue || '到点扫码打卡' }}</text>
            </view>
            <view class="station-state">
              <text v-if="progressStations.includes(s.order)" class="done-tag">已完成</text>
              <view v-else class="station-btn" @click="checkin(s.order)"><text>打卡</text></view>
            </view>
          </view>
        </view>
      </view>

      <!-- 主线谜底 -->
      <view class="section" v-if="story.mainPuzzle">
        <view class="section-head"><text class="section-title">主线谜底</text></view>
        <text class="puzzle-text">{{ story.mainPuzzle }}</text>
        <input class="puzzle-input" v-model="mainAnswer" :placeholder="story.hint || '输入你的答案'" />
        <view class="role-action" @click="submitAnswer">
          <text>{{ progress?.mainSolved ? '已破解' : (answering ? '验证中...' : '提交答案') }}</text>
        </view>
        <text class="feedback" :class="answerFeedback ? 'good' : ''">{{ answerFeedback }}</text>
      </view>

      <!-- 终章兑奖 -->
      <view class="section finale">
        <view class="section-head"><text class="section-title">终章兑奖</text></view>
        <text class="finale-hint">
          集齐全部站点并破解主线谜底后，可领取 {{ story.finalePoints }} 积分
        </text>
        <view class="role-action" @click="claimFinale" :class="{ disabled: !finaleReady || progress?.finaleClaimed }">
          <text>{{ claiming ? '发放中...' : (progress?.finaleClaimed ? '已领取终章大奖' : '领取终章积分') }}</text>
        </view>
        <text class="feedback good" v-if="progress?.finaleClaimed">终章积分已到账，恭喜完成任务！</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  getTourStory,
  tourChooseRole,
  tourCheckinStation,
  tourAnswerMain,
  tourClaimFinale,
} from '../../services/api'

const documentId = ref('')
const story = ref<any>(null)
const loading = ref(false)
const progress = ref<any>(null)

const selectedRole = ref('')
const submittingRole = ref(false)
const mainAnswer = ref('')
const answering = ref(false)
const answerFeedback = ref('')
const claiming = ref(false)

const storyRoles = computed(() => (Array.isArray(story.value?.roles) ? story.value.roles : []))
const stations = computed(() =>
  (Array.isArray(story.value?.itinerary) ? story.value.itinerary : []).slice().sort((a: any, b: any) => a.order - b.order)
)
const progressStations = computed(() => {
  const arr = progress.value?.stations
  return Array.isArray(arr) ? arr : []
})
const currentRoleName = computed(() => {
  const r = storyRoles.value.find((x: any) => String(x.id) === String(progress.value?.role)) || storyRoles.value.find((x: any) => String(x.name) === progress.value?.role)
  return r?.name || progress.value?.role || ''
})
const finaleReady = computed(
  () => stations.value.length > 0 && progressStations.value.length >= stations.value.length && !!progress.value?.mainSolved
)

onLoad((opts: any) => {
  documentId.value = opts?.id || ''
  if (documentId.value) loadStory()
})

async function loadStory() {
  if (!documentId.value) return
  loading.value = true
  try {
    const res = await getTourStory(documentId.value)
    story.value = res ?? null
    progress.value = res?.progress ?? null
    uni.setNavigationBarTitle({ title: res?.title || '剧本游' })
  } catch (e: any) {
    story.value = null
    if (e?.code === 'NOT_SIGNED') {
      uni.showToast({ title: '请先报名', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
    } else if (e?.code === 'NOT_TOUR') {
      uni.showToast({ title: '该活动不是剧本游', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
    }
  } finally {
    loading.value = false
  }
}

async function submitRole() {
  if (!selectedRole.value || submittingRole.value) return
  submittingRole.value = true
  try {
    const res = await tourChooseRole(documentId.value, selectedRole.value)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: '角色已选择', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '选择失败', icon: 'none' })
  } finally {
    submittingRole.value = false
  }
}

async function checkin(order: number) {
  try {
    const res = await tourCheckinStation(documentId.value, order)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: res?.already ? '该站点已打卡' : `打卡成功 +${story.value?.stationPoints}积分`, icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '打卡失败', icon: 'none' })
  }
}

async function submitAnswer() {
  if (progress.value?.mainSolved || answering.value) return
  if (!mainAnswer.value.trim()) return uni.showToast({ title: '请输入答案', icon: 'none' })
  answering.value = true
  try {
    const res = await tourAnswerMain(documentId.value, mainAnswer.value.trim())
    progress.value = res?.progress ?? progress.value
    if (res?.correct) {
      answerFeedback.value = `恭喜破解谜底！+${story.value?.mainPoints}积分`
    } else {
      answerFeedback.value = ''
      uni.showToast({ title: '答案不对，再想想', icon: 'none' })
    }
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    answering.value = false
  }
}

async function claimFinale() {
  if (!finaleReady.value || progress.value?.finaleClaimed || claiming.value) return
  claiming.value = true
  try {
    const res = await tourClaimFinale(documentId.value)
    progress.value = res?.progress ?? progress.value
    uni.showToast({ title: `已领取 ${story.value?.finalePoints} 积分`, icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '领取失败', icon: 'none' })
  } finally {
    claiming.value = false
  }
}
</script>

<style scoped>
.tour-page { min-height: 100vh; background: #f6f5f1; box-sizing: border-box; padding: 24rpx; }
.tour-state { padding: 160rpx 40rpx; text-align: center; color: #999; font-size: 28rpx; }
.tour-state--retry { color: #6b4f2a; }
.prologue { background: #2f2a24; color: #f3ead8; border-radius: 20rpx; padding: 36rpx 30rpx; margin-bottom: 24rpx; }
.prologue-title { display: block; font-size: 40rpx; font-weight: 700; }
.prologue-backdrop { display: block; margin-top: 16rpx; font-size: 28rpx; line-height: 1.7; color: #d9cdb4; }
.role-block { margin-top: 28rpx; }
.role-tip { font-size: 26rpx; color: #c9ba9a; }
.role-list { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 16rpx; }
.role-item { flex: 1 1 42%; min-width: 0; background: #3c362d; border: 2rpx solid transparent; border-radius: 14rpx; padding: 18rpx; }
.role-item.on { border-color: #d9a44c; }
.role-name { display: block; font-size: 30rpx; font-weight: 600; }
.role-desc { display: block; margin-top: 6rpx; font-size: 24rpx; color: #b7a98a; }
.role-action { margin-top: 24rpx; text-align: center; background: #d9a44c; color: #2f2a24; border-radius: 999rpx; padding: 22rpx 0; font-size: 30rpx; font-weight: 600; }
.role-action.disabled { opacity: 0.5; }
.role-chosen { display: block; margin-top: 20rpx; font-size: 28rpx; color: #b7a98a; }
.role-chosen-name { color: #d9a44c; font-weight: 600; }
.section { background: #fff; border-radius: 20rpx; padding: 28rpx 26rpx; margin-bottom: 24rpx; }
.section-head { margin-bottom: 16rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: #2f2a24; }
.station-item { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-bottom: 1rpx solid #f0ece3; }
.station-item:last-child { border-bottom: none; }
.station-item.done { opacity: 0.55; }
.station-order { width: 52rpx; height: 52rpx; line-height: 52rpx; text-align: center; border-radius: 50%; background: #efe7d6; color: #6b4f2a; font-weight: 600; }
.station-item.done .station-order { background: #2f2a24; color: #d9a44c; }
.station-body { flex: 1; min-width: 0; }
.station-name { display: block; font-size: 30rpx; font-weight: 600; color: #2f2a24; }
.station-clue { display: block; margin-top: 4rpx; font-size: 24rpx; color: #999; }
.station-btn { background: #d9a44c; color: #2f2a24; border-radius: 999rpx; padding: 10rpx 26rpx; font-size: 26rpx; font-weight: 600; }
.done-tag { color: #2f2a24; font-size: 26rpx; }
.puzzle-text { display: block; font-size: 28rpx; line-height: 1.7; color: #333; }
.puzzle-input { margin-top: 18rpx; border: 1rpx solid #e2dbcb; border-radius: 12rpx; padding: 18rpx; font-size: 28rpx; }
.feedback { display: block; margin-top: 16rpx; font-size: 26rpx; color: #c0392b; }
.feedback.good { color: #27ae60; }
.finale-hint { display: block; font-size: 26rpx; color: #999; margin-bottom: 20rpx; }
</style>