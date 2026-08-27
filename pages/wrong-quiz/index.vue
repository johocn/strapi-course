<template>
  <view class="page-container">
    <!-- 头部统计 -->
    <view class="banner">
      <view class="banner-info">
        <text class="banner-count">{{ totalActive }}</text>
        <text class="banner-label">未掌握错题</text>
      </view>
      <view class="banner-info">
        <text class="banner-count due">{{ dueCount }}</text>
        <text class="banner-label">待复习</text>
      </view>
      <view class="banner-action" @click="goPractice">
        <text class="banner-btn">去重练</text>
      </view>
    </view>

    <!-- 状态 Tab -->
    <view class="tabs">
      <view
        :class="['tab-item', { active: status === 'active' }]"
        @click="switchTab('active')"
      >
        <text>复习中</text>
        <text v-if="totalActive > 0" class="tab-badge">{{ totalActive }}</text>
      </view>
      <view
        :class="['tab-item', { active: status === 'archived' }]"
        @click="switchTab('archived')"
      >
        <text>已掌握</text>
        <text v-if="totalArchived > 0" class="tab-badge">{{ totalArchived }}</text>
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="loading" class="loading"><text>加载中...</text></view>
    <view v-else-if="items.length === 0" class="empty-state">
      <text class="empty-icon">{{ status === 'active' ? '🎉' : '📭' }}</text>
      <text class="empty-text">{{ status === 'active' ? '太棒了，没有待复习的错题' : '暂无已掌握的错题' }}</text>
    </view>
    <view v-else class="list">
      <view v-for="(it, idx) in items" :key="it.documentId ?? idx" class="wrong-item" @click="tapItem(it)">
        <view class="item-main">
          <view class="item-top">
            <text class="item-type">{{ typeText(it.quiz?.type) }}</text>
            <text v-if="it.quiz?.difficulty" class="item-diff">{{ difficultyText(it.quiz.difficulty) }}</text>
            <text class="item-level" v-if="status === 'active'">Lv.{{ it.reviewLevel ?? 1 }}</text>
          </view>
          <rich-text class="item-title" :nodes="it.quiz?.title"></rich-text>
          <view class="item-meta">
            <text v-if="it.knowledgePointName" class="meta-kp">📌 {{ it.knowledgePointName }}</text>
            <text v-else-if="lessonsOf(it)" class="meta-kp">📚 {{ lessonsOf(it) }}</text>
            <text class="meta-wrong">{{ it.wrongCount ?? 1 }} 次做错</text>
            <text v-if="status === 'archived' && it.lastCorrectAt" class="meta-time">掌握于 {{ fmtDate(it.lastCorrectAt) }}</text>
            <text v-else-if="it.dueAt" class="meta-time">下次复习 {{ fmtDate(it.dueAt) }}</text>
          </view>
        </view>
        <view v-if="status === 'active'" class="item-arrow">
          <text class="arrow-link">重练 →</text>
        </view>
      </view>
    </view>

    <!-- 空态去练习 -->
    <view v-if="status === 'active'" class="footer-tip">
      <text class="footer-tip-text">错题会按记忆曲线自动安排复习，连续答对后逐步升级直至掌握。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { getWrongQuizList, getWrongQuizDue, type WrongQuizItem } from '../../services/api'
import { typeText, difficultyText, stripHtml } from '../../utils/quiz-display'
import { getStoredAuthConfig } from '../../services/auth-config'
import { setupPageShare } from '../../utils/share'

const siteConfig = getStoredAuthConfig()
const status = ref<'active' | 'archived'>('active')
const items = ref<WrongQuizItem[]>([])
const loading = ref(false)
const totalActive = ref(0)
const totalArchived = ref(0)
const dueCount = ref(0)

function fmtDate(v?: string): string {
  if (!v) return ''
  const d = new Date(v)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function lessonsOf(it: WrongQuizItem): string {
  const l = it.quiz?.lesson || it.lesson
  const c = it.quiz?.course || it.course
  return `${c?.title ? stripHtml(c.title) + ' · ' : ''}${l?.title ? stripHtml(l.title) : ''}`
}

async function load() {
  loading.value = true
  try {
    const [activeRes, archivedRes, dueRes] = await Promise.all([
      getWrongQuizList({ status: 'active', pageSize: 100 }),
      getWrongQuizList({ status: 'archived', pageSize: 100 }),
      getWrongQuizDue(1),
    ])
    totalActive.value = activeRes?.meta?.pagination?.total ?? activeRes?.data?.length ?? 0
    totalArchived.value = archivedRes?.meta?.pagination?.total ?? archivedRes?.data?.length ?? 0
    dueCount.value = dueRes?.meta?.pagination?.total ?? dueRes?.data?.length ?? 0
    // 刷新当前 tab 列表
    const curRes = status.value === 'active' ? activeRes : archivedRes
    items.value = curRes?.data ?? []
  } catch (e: any) {
    uni.showToast({ title: e?.error?.message ?? e?.message ?? '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function switchTab(s: 'active' | 'archived') {
  if (status.value === s) return
  status.value = s
  await load()
}

function tapItem(it: WrongQuizItem) {
  if (status.value !== 'active') return
  goPractice()
}

function goPractice() {
  if (dueCount.value <= 0) {
    uni.showToast({ title: '暂无待复习错题', icon: 'none' })
    return
  }
  uni.navigateTo({ url: `/pages/quiz/practice?mode=wrong` })
}

onShow(() => {
  load()
})

onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})

onMounted(() => {
  // #ifndef H5
  uni.setNavigationBarTitle({ title: siteConfig?.siteName ?? '错题集' })
  // #endif
  setupPageShare({ title: '错题本' })
})
</script>

<style lang="scss" scoped>
.page-container { min-height: 100vh; background: #f5f5f5; padding-bottom: 60rpx; }

.banner {
  display: flex; align-items: center; justify-content: space-around;
  margin: 30rpx; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx; padding: 36rpx 20rpx;
}
.banner-info { text-align: center; }
.banner-count { display: block; font-size: 52rpx; font-weight: bold; color: #fff; }
.banner-count.due { color: #ffe082; }
.banner-label { display: block; font-size: 24rpx; color: rgba(255,255,255,0.85); margin-top: 6rpx; }
.banner-action { }
.banner-btn {
  background: rgba(255,255,255,0.9); color: #667eea; font-size: 28rpx; font-weight: bold;
  padding: 16rpx 30rpx; border-radius: 40rpx;
}

.tabs {
  display: flex; margin: 0 30rpx; background: #fff; border-radius: 16rpx; overflow: hidden;
}
.tab-item {
  flex: 1; height: 84rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx;
  font-size: 28rpx; color: #666;
  &.active { color: #667eea; font-weight: bold; border-bottom: 6rpx solid #667eea; }
}
.tab-badge { background: #667eea; color: #fff; font-size: 20rpx; padding: 2rpx 12rpx; border-radius: 20rpx; }

.list { margin: 20rpx 30rpx; }
.wrong-item {
  display: flex; background: #fff; border-radius: 16rpx; padding: 26rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.05); align-items: center;
}
.item-main { flex: 1; }
.item-top { display: flex; align-items: center; gap: 14rpx; margin-bottom: 12rpx; flex-wrap: wrap; }
.item-type { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; font-size: 22rpx; padding: 4rpx 16rpx; border-radius: 20rpx; }
.item-diff { font-size: 22rpx; color: #ff9800; background: #fff3e0; padding: 4rpx 14rpx; border-radius: 20rpx; }
.item-level { font-size: 22rpx; color: #667eea; background: #e8eaf6; padding: 4rpx 14rpx; border-radius: 20rpx; }
.item-title { font-size: 30rpx; color: #333; line-height: 1.5; }
.item-meta { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 14rpx; }
.meta-kp { font-size: 24rpx; color: #667eea; }
.meta-wrong { font-size: 24rpx; color: #f44336; }
.meta-time { font-size: 24rpx; color: #999; }
.item-arrow { margin-left: 16rpx; }
.arrow-link { font-size: 26rpx; color: #667eea; font-weight: bold; }

.footer-tip { margin: 20rpx 30rpx; background: #fff3e0; border-radius: 12rpx; padding: 20rpx; }
.footer-tip-text { font-size: 24rpx; color: #e65100; line-height: 1.5; }

.loading, .empty-state { padding: 100rpx 30rpx; text-align: center; }
.loading text { font-size: 28rpx; color: #999; }
.empty-icon { font-size: 80rpx; display: block; }
.empty-text { font-size: 28rpx; color: #999; margin-top: 20rpx; display: block; }
</style>